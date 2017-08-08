"use strict";
const pictures = `${__dirname}/pictures`;
const nodeDoubleClickModal = `${__dirname}/templates/firewall-modal.html`;
const path = require('path');
const fs = require('fs');
const {dialog} = require('electron').remote;
let $s, myOperate, myDiagram, currentThesisObject;
let nodeBeenDoubleClicked;

console.log(nodeDoubleClickModal);
function diagramOperate () {
	let nwCount = 0, fwCount = 0;
	this.mode = 'pointer';
	this.itemType = 'pointer';
	
	currentThesisObject.nodeDataArray.forEach( function (node) {
		if ( node.category === 'firewall' ) { fwCount += 1; }
		else if ( node.category === 'network' ) { nwCount += 1; }
	});

	this.nodeCounter = { network: nwCount, firewall: fwCount };
}

/*	[Topology Button Handler]
 *	Pointer:	initial function, a 
 *	Firewall:	click at diagram to create a new 'firewall' node
 *	Network:	click at diagram to create a new 'network' node
 *	Link:		drag and 'link' from a node to another node
 *	
 *	
 */
$('input[name="function-button"]').change( function ( e ) {
	// console.log(e.target.value);
	let mode, itemType;
	myDiagram.startTransaction();

	// if ( e.target.value == 'firewall' || e.target.value == 'network' ) {
	// 	mode = 'node';
	// 	itemType = e.target.value;
	// } else {
	// 	mode = e.target.value;
	// 	itemType = e.target.value;
	// }

	itemType = e.target.value;
	if ( itemType === 'firewall' || itemType === 'network' )	mode = 'node';
	else	mode = itemType;


	myOperate.mode = mode;
	myOperate.itemType = itemType;

	if (mode === "pointer") {
		myDiagram.allowLink = false;
		myDiagram.nodes.each(function(n) { n.port.cursor = ""; });
	} else if (mode === "node") {
		myDiagram.allowLink = false;
		myDiagram.nodes.each(function(n) { n.port.cursor = ""; });
	} else if (mode === "link") {
		myDiagram.allowLink = true;
		myDiagram.nodes.each(function(n) { n.port.cursor = "pointer"; });
	}

	myDiagram.commitTransaction("mode changed");
});


/*	Initial topology diagram setting.
 *	Initial topology diagram setting.
 */
function init ( thesisObject ) {
	$s = go.GraphObject.make;
	currentThesisObject = thesisObject;
	myOperate = new diagramOperate();

	myDiagram = $s(go.Diagram, 'topo-diagram', {
		initialContentAlignment: go.Spot.Center,
		allowLink: false,	// linking is only started via buttons, not modelessly
		// 'undoManager.isEnabled': true
		"animationManager.isEnabled": false,
		"linkingTool.portGravity": 0,	// no snapping while drawing new links
		"linkingTool.doActivate": function() {
			// change the curve of the LinkingTool.temporaryLink
			this.temporaryLink.curve = go.Link.Normal;
			this.temporaryLink.path.stroke = 'black';
			this.temporaryLink.path.strokeWidth = 2;
			go.LinkingTool.prototype.doActivate.call(this);
		},

		// override the link creation process
		"linkingTool.insertLink": function(fromnode, fromport, tonode, toport) {
			// to control what kind of Link is created,
			// change the LinkingTool.archetypeLinkData's category
			myDiagram.model.setCategoryForLinkData(this.archetypeLinkData, myOperate.itemType);
			// Whenever a new Link is drawng by the LinkingTool, it also adds a node data object
			// that acts as the label node for the link, to allow links to be drawn to/from the link.
			this.archetypeLabelNodeData = (myOperate.itemType === "flow") ? { category: "valve" } : null;
			// also change the text indicating the condition, which the user can edit
			this.archetypeLinkData.text = myOperate.itemType;
			return go.LinkingTool.prototype.insertLink.call(this, fromnode, fromport, tonode, toport);
		},

		"clickCreatingTool.archetypeNodeData": {},  // enable ClickCreatingTool
		"clickCreatingTool.isDoubleClick": false,   // operates on a single click in background
		"clickCreatingTool.canStart": function() {  // but only in "node" creation mode
			return myOperate.mode === 'node' && go.ClickCreatingTool.prototype.canStart.call(this);
		},
		"clickCreatingTool.insertPart": function ( loc ) {  // customize the data for the new node
			myOperate.nodeCounter[myOperate.itemType] += 1;
			// console.log(myOperate.nodeCounter);
			var newNodeId = myOperate.itemType + myOperate.nodeCounter[myOperate.itemType];
			this.archetypeNodeData = {
				key: newNodeId,
				category: myOperate.itemType,
				label: newNodeId
			};
			return go.ClickCreatingTool.prototype.insertPart.call(this, loc);
		}
	});

	// install the NodeLabelDraggingTool as a "mouse move" tool
	// myDiagram.toolManager.mouseMoveTools.insertAt(0, new NodeLabelDraggingTool());

	// when the document is modified, add a "*" to the title and enable the "Save" button
	myDiagram.addDiagramListener("Modified", function(e) {
		// var button = document.getElementById("SaveButton");
		// if (button) button.disabled = !myDiagram.isModified;
		var idx = document.title.indexOf("*");
		if (myDiagram.isModified) {
			if (idx < 0) document.title += "*";
		} else {
			if (idx >= 0) document.title = document.title.substr(0, idx);
		}
	});

	


	buildTemplates();
	// myDiagram.model = new go.GraphLinksModel(currentThesisObject.nodeDataArray, currentThesisObject.linkDataArray);
	update(currentThesisObject);
}

function update ( thesisObject ) {
	myDiagram.clear();
	currentThesisObject = thesisObject;
	myOperate = new diagramOperate();
	myDiagram.model = new go.GraphLinksModel(currentThesisObject.nodeDataArray, currentThesisObject.linkDataArray);
}

function nodeDoubleClicked ( e, obj ) {
	nodeBeenDoubleClicked = obj.part.data;
	$('#node-doubleclick-modal').modal('show');
}

/*	[modal showing handler]
 *	To fill the 
 */
$('#node-doubleclick-modal').on('show.bs.modal', function () {
	console.log('modal show');

	fs.readFile(nodeDoubleClickModal, 'utf-8', function ( err, data ) {
		if ( err ) {
			alert("An error ocurred reading the file :" + err.message);
			return;
		}
		console.log(data);
	});



	$('div#node-doubleclick-modal .modal-header h1').text(nodeBeenDoubleClicked.label);

	if ( nodeBeenDoubleClicked.category === 'firewall' ) {}
	else if ( nodeBeenDoubleClicked.category === 'network' ) {}

	console.log($('div#node-doubleclick-modal .modal-header h1'));
	
	
});

$('#node-doubleclick-modal').on('shown.bs.modal', function () {
	console.log('modal shown');

	$('#import-acl-button').on('click', function () {
		console.log('import-acl-button been click');
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
				console.log(data);
			});
		});
	});

	$('#tab-add-button').on('click', function () {
		console.log('add tabs');
	});
});

/*	[modal hidding handler]
 *	Get the 
 */
$('#node-doubleclick-modal').on('hide.bs.modal', function () {
	console.log('modal hide');
});

$('#node-doubleclick-modal').on('hidden.bs.modal', function () {
	console.log('modal hidden');
});




function buildTemplates () {

	function textStyle() {}
	function nodeStyle() {}
	function firewallStyle() {}
	function networkStyle() {}



	myDiagram.nodeTemplateMap.add('firewall',
		$s(go.Node, 'Vertical', 
			{ 
				doubleClick: nodeDoubleClicked,
				fromLinkable: true,
				toLinkable: true
			},
			$s(go.TextBlock, 'Default Text', 
				{ font: "bold 16px sans-serif" },
				new go.Binding('text', 'key')),
			$s(go.Picture, 
				// { source: `${pictures}/firewall-gray.png`, width: 50, height: 50 }
				{ source: `${pictures}/firewall.png`, width: 50, height: 50 }
				)));

	myDiagram.nodeTemplateMap.add('network',
		$s(go.Node, 'Vertical',
			{
				doubleClick: nodeDoubleClicked,
				fromLinkable: true,
				toLinkable: true
			},
			$s(go.TextBlock, 'Default Text', 
				{ font: "bold 16px sans-serif" },
				new go.Binding('text', 'key')),
			$s(go.Picture, 
				{ source: `${pictures}/network.png`, width: 50, height: 50 }
				)));

	myDiagram.linkTemplateMap.add('', $s(go.Link, $s(go.Shape)));
	myDiagram.linkTemplateMap.add('link', $s(go.Link, $s(go.Shape)));
}



module.exports.init = init;
module.exports.update = update;