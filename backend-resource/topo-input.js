/**
 * Declare variables sector.
 * */
const fs = require('fs');
const path = require('path');
const _ = require('underscore');
// const dataProcess = require( path.join(__dirname, 'dataProcess.js') );
const topoParser = require( path.join(__dirname, 'topo-input-parser.js') );
// const anomaly = require( path.join(__dirname, 'anomaly.js') );
// const ui = require( path.join(__dirname, 'ui.js') );
const topoUI = require( path.join(__dirname, 'topo-ui.js') );
// const TreeModel = require('tree-model');
const util = require('util'); // debug

// let tree = new TreeModel();
let $rule_input = $('#topo-input');

/**
 * Initial sector when loaded.
 * */
$rule_input.fileinput();


/* update button onclick event. */
$('button[class~="fileinput-upload-button"]').attr('type', 'button').on('click', function() {
    console.log('Upload button has been pressed.');
    //** clean old ui.
    $('#topo-diagram').remove();
    //** parse rules.
    rules_import_handler(document.getElementById('topo-input').files[0].path);
    
});

$rule_input.on('fileclear', function(event) {
    // $('#topo-diagram').remove();
    console.log("fileclear");
});

$rule_input.on('fileloaded', function(event, file, previewId, index, reader) {
    console.log("fileloaded");
});

/**
 * Methods sector.
 * */
function rules_import_handler (filepath) {
    // clean temp_rulesData first.
    console.log(filepath);
    let lineList = [];


    fs.readFileSync(filepath).toString().split('\n').forEach( (line) => {
        lineList.push(line);
    });
    // policy_parser(lineList);
    console.log(lineList);
    topoUI.init();
    
}