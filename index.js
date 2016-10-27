'use strict';

let creds = require('./creds.js').creds;
let Promise = require('bluebird');
let evernote = require('./base.js').Evernote;
evernote.Client = require('./client.js').Client;
let authToken;
let client;
let noteStore;
// let notebookguid;
// let noteFilter;
// let notesMetadataResultSpec;
// let noteguid;

function tagsNotebook(notebookguid) {
  // get tags of notebook
  let prms = Promise.promisify(noteStore.listTagsByNotebook);
  return prms(notebookguid)
}
function count(noteFilter) {
  // get count of notes of notebook
  let prms = Promise.promisify(noteStore.findNoteCounts);
  return prms(noteFilter, false)
}
function listNote(offset, count, noteFilter, notesMetadataResultSpec) {
  // get the guids of notes
  let prms = Promise.promisify(noteStore.findNotesMetadata);
  return prms(noteFilter, offset, count, notesMetadataResultSpec)
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
  let notesMetadataResultSpec = new evernote.NotesMetadataResultSpec;
  let noteFilter = new evernote.NoteFilter;
  noteFilter.notebookGuid = notebookguid;
  noteFilter.ascending = false;
  noteFilter.order = 1;
  let noteResults = [];

  return count(noteFilter)
    .then(response => listMoreNotes(0, response.notebookCounts[notebookguid], noteFilter, notesMetadataResultSpec, noteResults));
}
function notebook(notebookguid) {
  // get tags and note guids of notebook
  return Promise.all([
    // errors will be managed by caller
    tagsNotebook(notebookguid),
    notes(notebookguid)
  ])
}
function tagsNote(noteguid) {
  // get tags of note
  let prms = Promise.promisify(noteStore.getNoteTagNames);
  return prms(noteguid);
}
function selectpic(res) {
  // select a usable pic resource
  let lsindex = 0;
  let lsvalue = 0;
  let usableResources = [];

  if (res.resources) {
    // find out which resources have a non-empty sourceUrl
    for (let i = 0; i < res.resources.length; i++) {
      if (res.resources[i].attributes.sourceURL) usableResources.push(res.resources[i]);
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
      return usableResources[lsindex].attributes.sourceURL;
    } else {
      return '';
    }
  }
}
function notecontent(noteguid) {
  // get content of note
  let withContent = false;
  let withResourcesData = true;
  let withResourcesRecognition = false;
  let withResourcesAlternateData = false;
  let prms = Promise.promisify(noteStore.getNote);
  return prms(noteguid, withContent, withResourcesData, withResourcesRecognition, withResourcesAlternateData)
    .then(response => {
      let result = {
        'guid': response.guid,
        'title': response.title,
        'created': response.created,
        'updated': response.updated,
        'size': response.contentLength,
        'picUrl': selectpic(response),
        'sourceUrl': response.attributes.sourceURL || ''
      };
      return result
    });
}
function note(noteguid) {
  // get tags and content of note of notebook
  return Promise.all([
    // errors will be managed by caller
    tagsNote(noteguid),
    notecontent(noteguid)
  ])
}

exports.handler = (event, context, callback) => {
  // if no command was specified, then exit
  if ((event === undefined) || (event.cmd === undefined) || (event.cmd === '')) {
    callback(new Error('Missing cmd parameter'))
  } else {
    // init evernote api
    authToken = creds.token;
    client = new evernote.Client({
      token: authToken,
      sandbox: false
    });
    noteStore = client.getNoteStore();
    // main switch
    switch (event.cmd) {
    case 'getNotebooks':
      // get all notebooks of the authenticated user
      let prms = Promise.promisify(noteStore.listNotebooks);
      prms(authToken)
        .then(response => callback(null, response))
        .catch(error => callback(error));
      break;
    case 'getNotebook':
      // get info on a notebook
      // if no notebook guid was provided, then exit
      if (event.notebookguid === undefined) {
        callback(new Error('Missing notebook guid parameter'))
      } else {
        // notebookguid = event.notebookguid;
        // notesMetadataResultSpec = new evernote.NotesMetadataResultSpec;
        // noteFilter = new evernote.NoteFilter;
        // noteFilter.notebookGuid = notebookguid;
        // noteFilter.ascending = false;
        // noteFilter.order = 1;
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
        // noteguid = event.noteguid;
        note(event.noteguid)
          .then(response => {debugger; callback(null, {tags: response[0], note: response[1]})}) 
          .catch(error => {debugger; callback(error)});
      }
      break;
    default:
    }
  }
}

exports.handler({
  'cmd': 'getNote',
  'noteguid': '9166ce04-72a8-4321-b0d1-e8c83f84d223'
});
