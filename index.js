'use strict'

/**
 * Simple wrapper to selected evernote api functions
 * @param {*} event -
 * @param {*} context -
 * @param {*} callback -
 */
exports.handler = (event, context, callback) => {
  /**
   * Get tags of notebook
   * @param {*} notebookguid 
   */
  function tagsNotebook(notebookguid) {
    return noteStore.listTagsByNotebook(notebookguid)
  }

  /**
   * Get count of notes of notebook
   * @param {*} noteFilter 
   */
  function count(noteFilter) {
    return noteStore.findNoteCounts(noteFilter, false)
  }

  /**
   * Get the guids of notes
   * @param {*} offset 
   * @param {*} count 
   * @param {*} noteFilter 
   * @param {*} notesMetadataResultSpec 
   */
  function listNote(offset, count, noteFilter, notesMetadataResultSpec) {
    return noteStore.findNotesMetadata(
      noteFilter,
      offset,
      count,
      notesMetadataResultSpec
    )
  }

  /**
   * Get as many guids of notes as evernote will return and continue until the end
   * @param {*} offset 
   * @param {*} count 
   * @param {*} noteFilter 
   * @param {*} notesMetadataResultSpec 
   * @param {*} noteResults 
   */
  function listMoreNotes(
    offset,
    count,
    noteFilter,
    notesMetadataResultSpec,
    noteResults
  ) {
    return listNote(
      offset,
      count,
      noteFilter,
      notesMetadataResultSpec
    ).then(response => {
      // add new results to result set
      for (let index = 0; index < response.notes.length; index++) {
        noteResults.push({
          title: response.notes[index].title,
          message: '',
          guid: response.notes[index].guid,
          created: response.notes[index].created,
          updated: response.notes[index].updated,
          doc: '',
          visible: false // initiallization
        })
      }
      if (offset < count) {
        // there are still more notes, continue
        offset += response.notes.length
        return listMoreNotes(
          offset,
          count,
          noteFilter,
          notesMetadataResultSpec,
          noteResults
        )
      } else {
        return noteResults
      }
    })
  }

  /**
   * Get note guids of notebook
   * @param {*} notebookguid 
   */
  function notes(notebookguid) {
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
    let noteResults = []

    return count(noteFilter).then(response =>
      listMoreNotes(
        0,
        response.notebookCounts[notebookguid],
        noteFilter,
        notesMetadataResultSpec,
        noteResults
      )
    )
  }

  /**
   * Get tags and note guids of notebook
   * @param {*} notebookguid 
   */
  function notebook(notebookguid) {
    return Promise.all([tagsNotebook(notebookguid), notes(notebookguid)])
  }

  /**
   * Get tags of note
   * @param {*} noteguid 
   */
  function tagsNote(noteguid) {
    return noteStore.getNoteTagNames(noteguid)
  }

  /**
   * Select a usable pic resource
   * @param {*} resources 
   */
  function selectPic(resources) {
    let lsindex = 0
    let lsvalue = 0
    let result = ''

    if (resources) {
      // select a resource using evernote's 'largest-smallest' algorithm
      for (let i = 0; i < resources.length; i++) {
        let temp = Math.min(resources[i].width, resources[i].height)
        if (temp === 0) {
          continue
        }
        if (temp > lsvalue) {
          lsindex = i
          lsvalue = temp
        }
      }
      result = webApiUrlPrefix + 'res/' + resources[lsindex].guid
    }
    return result
  }

  /**
   * Get content of note (html, text and pic)
   * @param {*} noteguid 
   */
  function noteContent(noteguid) {
    let resHtml
    return noteStore
      .getNoteWithResultSpec(noteguid, {
        includeContent: true,
        includeResourcesData: true
      })
      .then(response => {
        if (response.message) {
          return Promise.reject(new Error(response.message))
        } else {
          resHtml = enml.HTMLOfENML(response.content, response.resources)
          return Promise.resolve({
            html: resHtml,
            text: sanitizeHtml(resHtml, {
              allowedTags: [],
              allowedAttributes: []
            }),
            pic: selectPic(response.resources) // TODO find the proper property name
          })
        }
      })
  }

  /**
   * Get tags, content (raw and sanitized) and pic of note of notebook
   * @param {*} noteguid 
   */
  function note(noteguid) {
    return Promise.all([tagsNote(noteguid), noteContent(noteguid)])
  }

  let creds = require('./creds.js').creds
  let Promise = require('bluebird')
  let Evernote = require('evernote')
  var sanitizeHtml = require('sanitize-html')
  let enml = require('enml-js')
  let client
  let noteStore
  let webApiUrlPrefix
  let result

  // If no command was provided, then exit immediately.
  if (event === undefined || event.cmd === undefined || event.cmd === '') {
    callback(new Error('Missing cmd parameter'))
  } else if (
    event.cmd !== 'sources' &&
    event.cmd !== 'list' &&
    event.cmd !== 'single'
  ) {
    callback(new Error('Unknown command'))
  } else {
    // Init evernote api.
    client = new Evernote.Client({
      token: creds.token,
      sandbox: false
    })
    client
      .getUserStore()
      .getPublicUserInfo(creds.userName)
      .then(response => {
        webApiUrlPrefix = response.webApiUrlPrefix
      })
    noteStore = client.getNoteStore()
    // Main switch.
    switch (event.cmd) {
      /**
       * Get sources (notebooks) of authenticated user.
       */
      case 'sources':
        noteStore
          .listNotebooks()
          .then(response => {
            result = []
            response.forEach(element => {
              result.push({
                name: element.name,
                guid: element.guid
              })
            })
            callback(null, result)
          })
          .catch(error =>
            callback(
              new Error('error: ' + error.errorCode + ' ' + error.parameter)
            )
          )
        break

      /**
       * Get cards (notes) of source (notebook).
       * @param {String} notebookguid - the notebook's guid
       */
      case 'list':
        // if required params are missing, then exit immediately.
        if (event.notebookguid === undefined) {
          callback(new Error('Missing notebook guid parameter'))
        } else {
          notebook(event.notebookguid)
            .then(response => {
              result = {}
              result.tags = response[0]
              result.notes = response[1]
              callback(null, result)
            })
            .catch(error => {
              callback(
                new Error('error: ' + error.errorCode + ' ' + error.parameter)
              )
            })
        }
        break

      /**
       * Get contents of card (note).
       * @param {String} noteguid - the note's guid
       */
      case 'single':
        // if required params are missing, then exit immediately.
        if (event.noteguid === undefined) {
          callback(new Error('Missing note guid parameter'))
        } else {
          note(event.noteguid)
            .then(response => {
              result = {}
              result.noteTags = response[0]
              result.noteHtml = response[1].html
              result.noteText = response[1].text
              result.notePic = response[1].pic
              callback(null, result)
            })
            .catch(error => {
              callback(
                new Error('error: ' + error.errorCode + ' ' + error.parameter)
              )
            })
        }
        break
      default:
    }
  }
}

/*
exports.handler({
  // cmd: 'sources'

  // cmd: 'list',
  // notebookguid: 'bf0ff626-e6e1-4bcb-bdfd-07f9c318cb76'

  // cmd: 'single',
  // noteguid: '2e8a4246-4098-48bc-82d2-836aa6013e42'
})
*/
