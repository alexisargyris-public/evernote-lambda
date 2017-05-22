[![Build Status](https://semaphoreci.com/api/v1/alexisargyris/evernote-lambda/branches/master/shields_badge.svg)](https://semaphoreci.com/alexisargyris/evernote-lambda)

# evernote-lambda
a simple, promise-based, wrapper of selected [evernote api](https://dev.evernote.com/doc/reference) functions for aws lambda.

## authentication

A file named 'creds.js' is required with the following content:

    const creds = {
      'token': '<evernote-token>'
    };
    exports.creds = creds;

## evernote api

The following commands are supported:

* `sources()`: get all user notebooks.
* `list(notebookguid)`: get all notes of selected notebook.
* `single(noteguid)`: get content (noteHtml, noteText, notePic) of selected note.
