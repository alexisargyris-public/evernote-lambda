var creds = require('./creds.js').creds;
var evernote = require('./base.js').Evernote;
evernote.Client = require('./client.js').Client;
var authToken;
var client;
var noteStore;
var notebookguid;
var noteFilter;
var notesMetadataResultSpec;
var noteResults;
var noteguid;

function tagsNotebook(notebookguid) {
  // get tags of notebook
  return new Promise((resolve, reject) => {
    noteStore.listTagsByNotebook(notebookguid, function (err, res) {
      if (err) { reject(new Error(err)); } 
      else { resolve(res); }
    })
  })
}
function count() {
  // get count of notes of notebook
  return new Promise((resolve, reject) => {
    noteStore.findNoteCounts(noteFilter, false, function (err, res) {
      if (err) { reject(new Error(err)); } 
      else { resolve(res); }
    })
  })
}
function listNote(offset, count) {
  // get the guids of notes
  return new Promise((resolve, reject) => {
    noteStore.findNotesMetadata(noteFilter, offset, count, notesMetadataResultSpec, function (err, res) {
      if (err) { reject(new Error(err)); } 
      else { resolve(res); }
    })
  })
}
function listMoreNotes(offset, count, resolve) {
  // get as many guids of notes as evernote will return and continue until the end
  listNote(offset, count)
    .then(response => {
      // add new results to result set
      for (var index = 0; index < response.notes.length; index++) {
        noteResults.push(response.notes[index]);
      }
      offset += response.notes.length;
      if (offset < count) {
        // there are still more notes, continue
        listMoreNotes(offset, count, resolve);
      } else {
        resolve(noteResults);
      }
    })
    .catch(reason => { throw new Error(reason); });
}
function notes(notebookguid) {
  // get note guids of notebook
  return new Promise((resolve, reject) => {
    count()
      .then(response => {
        var count = response.notebookCounts[notebookguid];
        noteResults = [];
        listMoreNotes(0, count, resolve);
      })
      .catch(reason => reject(reason))
  })
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
  return new Promise((resolve, reject) => {
    noteStore.getNoteTagNames(noteguid, function (err, res) {
      if (err) { reject(new Error(err)); } 
      else { resolve(res); }
    })
  })
}
function selectpic(res) {
  // select a usable pic resource
  var 
    lsindex = 0,
    lsvalue = 0;
    usableResources = [];

  if (res.resources) {
    // find out which resources have a non-empty sourceUrl
    for(var i = 0; i < res.resources.length; i++) {
      if (res.resources[i].attributes.sourceURL) usableResources.push(res.resources[i]);
    }
    if (usableResources.length > 0) {
      // select a resource using evernote's 'largest-smallest' algorithm
      for(var i = 0; i < usableResources.length; i++) {
        var temp = Math.min(usableResources[i].width, usableResources[i].height);
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
  return new Promise((resolve, reject) => {
    var withContent = false;
    var withResourcesData = true;
    var withResourcesRecognition = false;
    var withResourcesAlternateData = false;

    noteStore.getNote(noteguid, withContent, withResourcesData, withResourcesRecognition, withResourcesAlternateData, function (err, res) {
      if (err) { reject(new Error(err)); } 
      else {
        resolve({
          "guid": res.guid,
          "title": res.title,
          "created": res.created,
          "updated": res.updated,
          "size": res.contentLength,
          "picUrl": selectpic(res),
          "sourceUrl": res.attributes.sourceURL || ''
        });
      }
    })
  })
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
    authToken = creds.token;
    client = new evernote.Client({ token: authToken, sandbox: false });
    noteStore = client.getNoteStore();
    switch (event.cmd) {
    case 'getNotebooks':
      // get all notebooks of the authenticated user
      noteStore.listNotebooks(authToken, (error, response) => {
        context.callbackWaitsForEmptyEventLoop = false;
        if (error) { callback(error) } 
        else { callback(null, response) }
      });
      break;
    case 'getNotebook':
      // get info on a notebook
      // if no notebook guid was provided, then exit
      if (event.notebookguid === undefined) {
        callback(new Error('Missing notebook guid parameter'))
      } else {
        notebookguid = event.notebookguid;
        notesMetadataResultSpec = new evernote.NotesMetadataResultSpec;
        noteFilter = new evernote.NoteFilter;
        noteFilter.notebookGuid = notebookguid;
        noteFilter.ascending = false;
        noteFilter.order = 1;
        notebook(notebookguid)
          .then(response => { if (callback !== undefined) callback(null, {tags: response[0], notes: response[1]}) }) 
          .catch(reason => { if (callback !== undefined) callback(reason) })
      }
     break;
    case 'getNote':
      // get info on a note
      // if no note guid was provided, then exit
      if (event.noteguid === undefined) {
        callback(new Error('Missing notebook guid parameter'))
      } else {
        noteguid = event.noteguid;
        note(noteguid)
          .then(response => { if (callback !== undefined) callback(null, {tags: response[0], note: response[1]}) }) 
          .catch(reason => { if (callback !== undefined) callback(reason) })
      }
      break;
    default:
    }
  }
}

// exports.handler({
//   "cmd": "getNotebook",
//   "notebookguid": "bf0ff626-e6e1-4bcb-bdfd-07f9c318cb76"
// }, null, function(err, res) { console.log(res['notes'].length); });
