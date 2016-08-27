[![Build Status](https://semaphoreci.com/api/v1/alexisargyris/evernote-lambda/branches/master/shields_badge.svg)](https://semaphoreci.com/alexisargyris/evernote-lambda)

# evernote-lambda
a simple wrapper of selected [evernote api](https://dev.evernote.com/doc/reference) functions for aws lambda

## authentication

A file named 'creds.js' is required with the following content:

    const creds = {
      'token': '<evernote-token>'
    };
    exports.creds = creds;

## evernote api

The following functions are covered:

* [listNotebooks](https://dev.evernote.com/doc/reference/NoteStore.html#Fn_NoteStore_listNotebooks)  / getNotebooks(): get all notebooks of the authenticated user
* [listTagsByNotebook](https://dev.evernote.com/doc/reference/NoteStore.html#Fn_NoteStore_listTagsByNotebook) / getNotebook(notebookguid): get the tags of a notebook
* [findNoteCounts](https://dev.evernote.com/doc/reference/NoteStore.html#Fn_NoteStore_findNoteCounts) / getNotebook(notebookguid): get the number of notes in a notebook
* [findNotesMetadata](https://dev.evernote.com/doc/reference/NoteStore.html#Fn_NoteStore_findNotesMetadata) / getNotebook(notebookguid): get info on the notes of a notebook 
* [getNoteTagNames](https://dev.evernote.com/doc/reference/NoteStore.html#Fn_NoteStore_getNoteTagNames) / getNote(noteguid): get the tags of a note
* [getNote](https://dev.evernote.com/doc/reference/NoteStore.html#Fn_NoteStore_getNote) / getNote(noteguid): get the content of a note