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

The following functions are supported:

* `getNotebooks()`: get all user notebooks
* `getNotebook()`: get info (tags and note guids) on a notebook
* `getNote()`: get tags, content (html and text) and major pic of note
