'use strict';

let creds = require('./creds.js').creds;
let Promise = require('bluebird');
let Evernote = require('evernote');
var sanitizeHtml = require('sanitize-html');
let enml = require('enml-js');
let client;
let noteStore;

function tagsNotebook(notebookguid) {
  // get tags of notebook
  return noteStore.listTagsByNotebook(notebookguid);
}
function count(noteFilter) {
  // get count of notes of notebook
  return noteStore.findNoteCounts(noteFilter, false);
}
function listNote(offset, count, noteFilter, notesMetadataResultSpec) {
  // get the guids of notes
  return noteStore.findNotesMetadata(noteFilter, offset, count, notesMetadataResultSpec);
}
function listMoreNotes(offset, count, noteFilter, notesMetadataResultSpec, noteResults) {
  // get as many guids of notes as evernote will return and continue until the end
  return listNote(offset, count, noteFilter, notesMetadataResultSpec)
    .then(response => {
      // add new results to result set
      for (let index = 0; index < response.notes.length; index++) {
        noteResults.push(response.notes[index]);
      }
      if (offset < count) {
        // there are still more notes, continue
        offset += response.notes.length;
        return listMoreNotes(offset, count, noteFilter, notesMetadataResultSpec, noteResults);
      } else {
        return noteResults;
      }
    });
}
function notes(notebookguid) {
  // get note guids of notebook
  let notesMetadataResultSpec = {
    includeTitle: true,
    includeContentLength: true,
    includeCreated: true,
    includeUpdated: true,
    includeTagGuids: true
  }
  let noteFilter = {
    notebookGuid: notebookguid,
    ascending: false,
    order: 1
  }
  let noteResults = [];

  return count(noteFilter)
    .then(response => listMoreNotes(0, response.notebookCounts[notebookguid], noteFilter, notesMetadataResultSpec, noteResults));
}
function notebook(notebookguid) {
  // get tags and note guids of notebook
  return Promise.all([tagsNotebook(notebookguid), notes(notebookguid)])
}
function tagsNote(noteguid) {
  // get tags of note
  return noteStore.getNoteTagNames(noteguid);
}
function selectPic(resources) {
  // choose a usable pic resource
  let lsindex = 0;
  let lsvalue = 0;
  let usableResources = [];
  let result = '';

  if (resources) {
    // find out which resources have a non-empty sourceUrl
    for (let i = 0; i < resources.length; i++) {
      if (resources[i].attributes.sourceURL) usableResources.push(resources[i]);
    }
    if (usableResources.length > 0) {
      // select a resource using evernote's 'largest-smallest' algorithm
      for (let i = 0; i < usableResources.length; i++) {
        let temp = Math.min(usableResources[i].width, usableResources[i].height);
        if (temp === 0) { continue; }
        if (temp > lsvalue) {
          lsindex = i;
          lsvalue = temp;
        }
      }
      result = usableResources[lsindex].attributes.sourceURL;
    }
  }
  return result;
}
function noteContent(noteguid) {
  // get content of note (html, text and pic)
  let resHtml;
  return noteStore.getNoteWithResultSpec(noteguid, {'includeContent': true, 'includeResourcesData' : true})
    .then(response => {
      if (response.message) { return Promise.reject(new Error(response.message))}
      else {
        resHtml = enml.HTMLOfENML(response.content, response.resources);
        return Promise.resolve({
          html: resHtml,
          text: sanitizeHtml(resHtml, {allowedTags: [], allowedAttributes: []}),
          pic: selectPic(response.resources) // TODO find the proper property name
        });
      }
    })
}
function note(noteguid) {
  // get tags, content (raw and sanitized) and pic of note of notebook
  return Promise.all([tagsNote(noteguid), noteContent(noteguid)]);
}

exports.handler = (event, context, callback) => {
  // if no command was specified, then exit
  if ((event === undefined) || (event.cmd === undefined) || (event.cmd === '')) {
    callback(new Error('Missing cmd parameter'))
  } else {
    // init evernote api
    client = new Evernote.Client({
      token: creds.token,
      sandbox: false
    });
    noteStore = client.getNoteStore();
    // main switch
    switch (event.cmd) {
    case 'getNotebooks':
      // get all notebooks of the authenticated user
      noteStore.listNotebooks()
        .then(response => callback(null, response))
        .catch(error => callback(error));
      break;
    case 'getNotebook':
      // get info on a notebook
      // if no notebook guid was provided, then exit
      if (event.notebookguid === undefined) {
        callback(new Error('Missing notebook guid parameter'))
      } else {
        notebook(event.notebookguid)
          .then(response => callback(null, {tags: response[0], notes: response[1]})) 
          .catch(error => callback(error));
      }
     break;
    case 'getNote': 
      // get info on a note
      // if no note guid was provided, then exit
      if (event.noteguid === undefined) {
        callback(new Error('Missing notebook guid parameter'))
      } else {
        note(event.noteguid)
          .then(response => callback(null, {noteTags: response[0], noteHtml: response[1].html, noteText: response[1].text, notePic: response[1].pic}))
          .catch(error => callback(error));
      }
      break;
    default:
    }
  }
}

/*
  exports.handler({
    // cmd: 'getNotebooks',
    cmd: 'getNotebook',
    // cmd: 'getNote',
    notebookguid: 'bf0ff626-e6e1-4bcb-bdfd-07f9c318cb76'
    // noteguid: '6b415a9c-2666-4cd8-8be1-0a3d615aca65'
    // noteguid: 'a969ad1e-1e1a-4ae7-8410-19069fd17c8b'
  });
*/
