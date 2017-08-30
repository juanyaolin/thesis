"use strict";

const fs = require('fs');
const path = require('path');
const _ = require('underscore');
const {dialog} = require('electron').remote;
const topoUI = require( path.join(__dirname, 'topo-ui.js') );
const ARARTree = require( path.join(__dirname, 'myarar.js') );
const util = require('util'); // debug
const QueueObject = require('./myqueue.js');



/*	[load button Handler]
 *	To import a exist project file into Programming.
 */
$('button[id="project-load-button"]').attr('type', 'button').on('click', function() {
	console.log('load-button pressed');

	dialog.showOpenDialog( function ( filepath ) {
		// filepath is an array that contains all the selected
		console.log(filepath);
		if ( filepath === undefined ) {
			console.log("No file selected");
			return;
		}
		fs.readFile(filepath[0], 'utf-8', function ( err, data ) {
			if ( err ) {
				alert("An error ocurred reading the file :" + err.message);
				return;
			}
			myObject = new myThesisObject(JSON.parse(data));
			myObject.update();
		});
	});
});

/*	[load button Handler]
 *	If it's a new project, there will be 'save-as' new file.
 *	If it's a object have been loaded or saved, there will be 'update' file.
 */
$('button[id="project-save-button"]').attr('type', 'button').on('click', function () {
	console.log('save-button pressed');
	if ( myObject.filepath === null ) {
		dialog.showSaveDialog( function ( filepath ) {
			if ( filepath === undefined ) {
				console.log("You didn't save the file");
				return;
			}
			// filepath is a string that contains the path and filename created in the save file dialog.
			myObject.filepath = filepath;
			fs.writeFile(myObject.filepath, JSON.stringify(myObject), function ( err ) {
				if(err){
					alert("An error ocurred creating the file "+ err.message)
				}
				alert("The file has been succesfully saved");				
			});
		});
	} else {
		fs.writeFile(myObject.filepath, JSON.stringify(myObject), function ( err ) {
			if (err) {
				alert("An error ocurred updating the file" + err.message);
				console.log(err);
				return;
			}
			alert("The file has been succesfully updated");
		});
	}
});

/*	[inspect button Handler]
 *	
 */
$('button[id="inspect-button"]').attr('type', 'button').on('click', function () {
	console.log('inspect');
	let topoPath = myTopology(myObject.nodeDataArray, myObject.linkDataArray);

	Object.keys(myObject['aclObject']).forEach(function ( nodeName, nodeNameCount ) {
		myObject['aclObject'][nodeName]['ARARTree'] = new ARARTree(myObject['aclObject'][nodeName]['ruleList'], true, true, 2);
	});


	// console.log(curPath);
	// curPath.showTopo();
	// curPath.showPath();
	// curPath.showNode();
	// curPath.show();
});



/*	[myThesisObject Constructor]
 *	If it's a new project, there will be 'save-as' new file.
 *	If it's a object have been loaded or saved, there will be 'update' file.
 */
function myThesisObject ( item=null ) {
	if ( item === null) {
		this.filepath = null;
		this.nodeDataArray = [];
		this.linkDataArray = [];
		this.aclObject = {};
		
	}
	else {
		this.filepath = item.filepath;
		this.nodeDataArray = item.nodeDataArray;
		this.linkDataArray = item.linkDataArray;
		this.aclObject = item.aclObject;
		
	}

	this.showObject = function ( mode=false ) {
		if ( mode )
			console.log(util.inspect( this, { showHidden: false, depth:null } ));
		else
			console.log(this);
	}
	this.start = function () {
		topoUI.init(this);
	}
	this.update = function () {
		topoUI.update(this);
	}

	
}














/*
 *	In initial of Programming, there is a new(blank) project been prepared.
 */
let myObject = new myThesisObject();

// myObject.nodeDataArray = [
// 	{ key: 'firewall1', category: 'firewall', label: 'firewall1', __gohashid: 438 }
// ];

myObject.start();


$('button[id="setting"]').attr('type', 'button').on('click', function() {
	console.log('setting pressed');


	let queue = new QueueObject(3, 10, true);
	// queue.push(`[test]`);
	// console.log(queue.shift());
	// queue.push(`[test1]`);
	// queue.push(`[test2]`);
	// console.log(queue.shift());
	// console.log(queue.shift());


	for (var i = 0; i < 2000; i++) {
		if ( !queue.isFull() )
			queue.push(`[${i}]`);
	}
	console.log(queue);
	for (var i = 0; i < 2000; i++) {
		if ( !queue.isEmpty() )
			console.log(queue.shift());
	}
	console.log(queue);
	// queue.shift();
});

$('button[id="show-object"]').attr('type', 'button').on('click', function() {
	myObject.showObject();
});
