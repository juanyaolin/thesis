
// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
const {webFrame} = require('electron')
webFrame.setZoomFactor(1);
const rulesInput = require('./backend-resource/backend-main.js');
// const sampleUI = require('./backend-resource/sample-ui-test.js');




