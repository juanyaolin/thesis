"use strict";
const pictures = `${__dirname}/pictures`;
// const nodeDoubleClickModal = `${__dirname}/templates/firewall-modal.html`;
const path = require('path');
const fs = require('fs');
const {dialog} = require('electron').remote;
const ACLObject = require( './acl-file-parser.js');
const modalDepict = require( './modal-depict.js');

let $s, myOperate, myDiagram, curThesisObj;
let nodeBeenDoubleClicked, curNodeACLObj;
let preAction, curAction = 'topo-pointer-button';


function diagramOperate () {
	let nwCount = 0, fwCount = 0;
	this.mode = 'pointer';
	this.itemType = 'pointer';
	
	curThesisObj.nodeDataArray.forEach( function (node) {
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
	preAction = curAction;
	curAction = e.currentTarget.parentNode.id;
	if ( preAction !== undefined ) 
		$(`#${preAction}`).removeClass('btn-light');
	$(`#${curAction}`).addClass('btn-light');
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




/*	[generate button Handler]
 *	
 */
$('button[id="project-generate-button"]').attr('type', 'button').on('click', function () {
	console.log('generate-button pressed');
	let modalHTMLPath, modalHTMLData, $modal, $confirm;

	modalHTMLPath = `${__dirname}/templates/generate-modal.html`;
	modalHTMLData = fs.readFileSync(modalHTMLPath, 'utf-8').toString();
	$(modalHTMLData).insertAfter('#main-container');

	$modal = $('#generate-modal');
	$confirm = $('#modal-confirm-button');

	$modal.on('show.bs.modal', function () {
		$confirm.on('click', function () {
			console.log('confirm');
			let nodeData;
			// counter = {
			// 	network: document.getElementById('network-spinner').value,
			// 	firewall: document.getElementById('firewall-spinner').value,
			// 	rule: document.getElementById('rule-spinner').value,
			// };
			curThesisObj['geneInfo'] = {
				rangeSize: $('input[name="range-radio"]:checked').val(),
				network: document.getElementById('network-spinner').value,
				firewall: document.getElementById('firewall-spinner').value,
				rule: document.getElementById('rule-spinner').value,
			};
			
			Object.keys(curThesisObj['geneInfo']).forEach(function ( nodeType, typeCount ) {
				if ( nodeType === 'rule' ) return;
				else if ( nodeType === 'rangeSize' ) return;
				for (let i=0; i<curThesisObj['geneInfo'][nodeType]; i++) {
					if ( nodeType === 'network' ) {
						myDiagram.model.addNodeData(new NewNode(nodeType, `${i+1}.0.0.0/8`));
					}
					else myDiagram.model.addNodeData(new NewNode(nodeType));
				}
			});

			linkNode();

			let curPath = new myTopology(curThesisObj.nodeDataArray, curThesisObj.linkDataArray);
			ruleGenerator(curThesisObj.aclObject, curPath.generateObject, curThesisObj['geneInfo'].rule, curThesisObj['geneInfo'].rangeSize);



			$modal.modal('hide');

			function NewNode ( nodeType, address=undefined ) {
				myOperate['nodeCounter'][nodeType]++;
				
				this.key = `${nodeType}${myOperate['nodeCounter'][nodeType]}`;
				this.category = `${nodeType}`;
				
				return this;
			}

			function linkNode () {
				let nodeArray = {
					network: [],
					firewall: []
				};
				curThesisObj.nodeDataArray.forEach(function ( curNode, curNodeCount ) {
					nodeArray[curNode.category].push(curNode);
				});

				// nw <--> fw
				nodeArray['network'].forEach(function ( curNode, curNodeCount ) {
					myDiagram.model.addLinkData({
						category: 'link',
						from: curNode.key,
						to: nodeArray['firewall'][randomValue(0, nodeArray['firewall'].length-1)].key,
						text: 'link'
					});
				});

				// fw <--> fw
				nodeArray['firewall'].forEach(function ( fromNode, fromNodeCount ) {
					let sliceNodeArray = nodeArray['firewall'].slice(fromNodeCount+1, nodeArray['firewall'].length);
					let linkCount = 0;

					if ( sliceNodeArray.length === 0 ) return;
					

					for (let toNodeCount=0; toNodeCount<sliceNodeArray.length; toNodeCount++) {
						let toNode = sliceNodeArray[toNodeCount];
						let randomRatio = 0;
						if ( sliceNodeArray.length > 50 ) randomRatio = 1;
						else if ( sliceNodeArray.length > 25 ) randomRatio = 2;
						else randomRatio = 3;


						if ( randomValue(0, randomRatio) ) {
							myDiagram.model.addLinkData({
								category: 'link',
								from: fromNode.key,
								to: toNode.key,
								text: 'link'
							});
							linkCount++;
						}
					}

					if ( linkCount === 0 ) {
						myDiagram.model.addLinkData({
							category: 'link',
							from: fromNode.key,
							to: sliceNodeArray[randomValue(0, sliceNodeArray.length-1)].key,
							text: 'link'
						});
					}
				});
			}



		});


		$('#network-spinner').ace_spinner({
			value: 2,
			min: 2,
			max: 3,
			step: 1,
			// on_sides: true,
			icon_up:'ace-icon fa fa-plus bigger-110',
			icon_down:'ace-icon fa fa-minus bigger-110',
			btn_up_class:'btn-success',
			btn_down_class:'btn-danger'
		});

		$('#firewall-spinner').ace_spinner({
			value: 1,
			min: 1,
			max: 5,
			step: 1,
			// on_sides: true,
			icon_up:'ace-icon fa fa-plus bigger-110',
			icon_down:'ace-icon fa fa-minus bigger-110',
			btn_up_class:'btn-success',
			btn_down_class:'btn-danger'
		});

		$('#rule-spinner').ace_spinner({
			value: 25,
			min: 25,
			max: 250,
			step: 25,
			// on_sides: true,
			icon_up:'ace-icon fa fa-plus bigger-110',
			icon_down:'ace-icon fa fa-minus bigger-110',
			btn_up_class:'btn-success',
			btn_down_class:'btn-danger'
		});

	});

	$modal.on('shown.bs.modal', function () {});
	$modal.on('hide.bs.modal', function () {});
	$modal.on('hidden.bs.modal', function () {
		$modal.remove();
	});
	// start to show
	$modal.modal('show');
});




/*	[init]
 *	Initial topology diagram setting.
 */
function init ( thesisObject ) {
	$s = go.GraphObject.make;
	curThesisObj = thesisObject;
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
				category: myOperate.itemType
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
	update(curThesisObj);
}

function clear () {}

function update ( thesisObject ) {
	myDiagram.clear();
	curThesisObj = thesisObject;
	myOperate = new diagramOperate();
	myDiagram.model = new go.GraphLinksModel(curThesisObj.nodeDataArray, curThesisObj.linkDataArray);

	// add modelchangedlistener
	myDiagram.model.addChangedListener(function ( e ) {
		let changedValue;
		// do not display some uninteresting kinds of transaction notifications
		if ( e.change === go.ChangedEvent.Transaction ) {
			if ( e.propertyName === "CommittingTransaction" || e.modelChange === "SourceChanged" ) return;
			// do not display any layout transactions
			if ( e.oldValue === "Layout" ) return;
		}  // You will probably want to use e.isTransactionFinished instead

		// handle the event of insert or remove a node
		if ( e.change.name === 'Insert' ) {
			// do when insert a new node
			changedValue = e.newValue;
			if ( changedValue.category === 'link' ) return;
			else if ( changedValue.category === 'network' ) {
				// console.log(changedValue);
				changedValue['address'] = `${myOperate.nodeCounter['network']}.0.0.0/8`;
			} else {
				curNodeACLObj = new ACLObject(changedValue.key);
				curThesisObj['aclObject'][changedValue.key] = curNodeACLObj;
			}

		} else if ( e.change.name === 'Remove' ) {
			// do when remove a old node
			changedValue = e.oldValue;
			if ( changedValue.category === 'link' ) return;
			else if ( changedValue.category === 'network' ) return;
			delete curThesisObj['aclObject'][changedValue.key];
			// console.log('Remove a node:');
			// console.log(changedValue);
		}
	});
}



function nodeDoubleClicked ( e, obj ) {
	// console.log('node been double-clicked');
	nodeBeenDoubleClicked = obj.part.data;
	buildModal(nodeBeenDoubleClicked.category);
}



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
				{ source: `${pictures}/network.png`, width: 50, height: 50 })
			));

	myDiagram.linkTemplateMap.add('', $s(go.Link, $s(go.Shape)));
	myDiagram.linkTemplateMap.add('link', $s(go.Link, $s(go.Shape)));
}



module.exports.init = init;
module.exports.update = update;





function buildModal ( modalType ) {
	let modalHTMLPath, modalHTMLData;
	let $modal, $importButton, $confirmButton;

	if ( modalType === 'network' ) {
		modalHTMLPath = `${__dirname}/templates/network-modal.html`;
		modalHTMLData = fs.readFileSync(modalHTMLPath, 'utf-8').toString();
		$(modalHTMLData).insertAfter('#main-container');
		// console.log(nodeBeenDoubleClicked);
		let [addr, mask] = (nodeBeenDoubleClicked.address).split('/');
		let [addr1st, addr2nd, addr3rd, addr4th] = addr.split('.');

		$modal = $('#network-doubleclick-modal');
		$confirmButton = $('#modal-confirm-button');

		$modal.on('show.bs.modal', function () {
			$('#network-doubleclick-modal .modal-header h1').text(curNodeACLObj.nodeName);

			$('#addr1st-spinner').ace_spinner({
				value: addr1st,
				min: 0,
				max: 255,
				step: 1,
				// on_sides: true,
				icon_up:'ace-icon fa fa-plus bigger-110',
				icon_down:'ace-icon fa fa-minus bigger-110',
				btn_up_class:'btn-success',
				btn_down_class:'btn-danger'
			});
			$('#addr2nd-spinner').ace_spinner({
				value: addr2nd,
				min: 0,
				max: 255,
				step: 1,
				// on_sides: true,
				icon_up:'ace-icon fa fa-plus bigger-110',
				icon_down:'ace-icon fa fa-minus bigger-110',
				btn_up_class:'btn-success',
				btn_down_class:'btn-danger'
			});
			$('#addr3rd-spinner').ace_spinner({
				value: addr3rd,
				min: 0,
				max: 255,
				step: 1,
				// on_sides: true,
				icon_up:'ace-icon fa fa-plus bigger-110',
				icon_down:'ace-icon fa fa-minus bigger-110',
				btn_up_class:'btn-success',
				btn_down_class:'btn-danger'
			});
			$('#addr4th-spinner').ace_spinner({
				value: addr4th,
				min: 0,
				max: 255,
				step: 1,
				// on_sides: true,
				icon_up:'ace-icon fa fa-plus bigger-110',
				icon_down:'ace-icon fa fa-minus bigger-110',
				btn_up_class:'btn-success',
				btn_down_class:'btn-danger'
			});
			$('#mask-spinner').ace_spinner({
				value: mask,
				min: 0,
				max: 32,
				step: 1,
				// on_sides: true,
				icon_up:'ace-icon fa fa-plus bigger-110',
				icon_down:'ace-icon fa fa-minus bigger-110',
				btn_up_class:'btn-success',
				btn_down_class:'btn-danger'
			});
		});
		$modal.on('shown.bs.modal', function () {});
		$modal.on('hide.bs.modal', function () {});
		$modal.on('hidden.bs.modal', function () {
			$modal.remove();
		});

		// start to show
		$modal.modal('show');

		$confirmButton.on('click', function () {
			console.log('confirm');
			addr1st = document.getElementById('addr1st-spinner').value;
			addr2nd = document.getElementById('addr2nd-spinner').value;
			addr3rd = document.getElementById('addr3rd-spinner').value;
			addr4th = document.getElementById('addr4th-spinner').value;
			mask = document.getElementById('mask-spinner').value;
			nodeBeenDoubleClicked.address = `${addr1st}.${addr2nd}.${addr3rd}.${addr4th}/${mask}`;
			$modal.modal('hide');
		});
	}
	else if ( modalType === 'firewall' ) {
		modalHTMLPath = `${__dirname}/templates/firewall-modal.html`;
		modalHTMLData = fs.readFileSync(modalHTMLPath, 'utf-8').toString();
		$(modalHTMLData).insertAfter('#main-container');

		$modal = $('#firewall-doubleclick-modal');
		$confirmButton = $('#modal-confirm-button');
		$importButton = $('#import-acl-button');

		$modal.on('show.bs.modal', function () {
			curNodeACLObj = curThesisObj['aclObject'][nodeBeenDoubleClicked.key];
			// console.log('key: ', nodeBeenDoubleClicked.key);
			// console.log('curThesisObj: ', curThesisObj);
			// console.log(`curThesisObj['aclObject']: `, curThesisObj['aclObject']);
			// console.log(`curThesisObj['aclObject'][nodeBeenDoubleClicked.key]: `, curThesisObj['aclObject'][nodeBeenDoubleClicked.key]);
			// console.log(`curNodeACLObj: `, curNodeACLObj);
			buildACLTable();
		});

		$modal.on('shown.bs.modal', function () {});
		
		$modal.on('hide.bs.modal', function () {});
		
		$modal.on('hidden.bs.modal', function () {
			$modal.remove();
		});

		$importButton.on('click', function () {
			console.log('import press');
			dialog.showOpenDialog( function ( filepath ) {
				// filepath is an array that contains all the selected
				// console.log(filepath);
				if ( filepath === undefined ) {
					console.log("No file selected");
					return;
				}
				let fileDataLine = fs.readFileSync(filepath[0], 'utf-8').toString().split('\n');
				curNodeACLObj = new ACLObject(nodeBeenDoubleClicked.key, fileDataLine);
				buildACLTable();
			});
		});

		$confirmButton.on('click', function () {
			console.log('confirm');
			curThesisObj['aclObject'][nodeBeenDoubleClicked.key] = curNodeACLObj;
			$modal.modal('hide');
		});

		// start to show
		$modal.modal('show');

		function buildACLTable () {
			console.log(curNodeACLObj);
			$('#firewall-doubleclick-modal .modal-header h1').text(curNodeACLObj.nodeName);

			$('.scrollable').each(function () {
				var $this = $(this);
				$(this).ace_scroll({
					size: $this.attr('data-size') || 400,
					//styleClass: 'scroll-left scroll-margin scroll-thin scroll-dark scroll-light no-track scroll-visible'
				});
			});

			if ( checkObjectIsEmpty(curNodeACLObj['ruleObject']) ) {
				console.log('empty')
				return;
			}

			$(`#acl-tabs`).children('[id!=modal-addtab-li]').remove();
			$(`#acl-table`).children().remove();


			Object.keys(curNodeACLObj['ruleObject']).sort().forEach(function ( eth, ethCount ) {
				let curIF = curNodeACLObj['ruleObject'][eth],
					ifTable = document.createElement('div'),
					scrollbar = document.createElement('div'),
					ifTab = document.createElement('li'),
					table = document.createElement('table'),
					thead = document.createElement('thead'),
					tbody = document.createElement('tbody'),
					thr = document.createElement('tr'),
					th_in_out = document.createElement('th'),
					th_order = document.createElement('th'),
					th_protocol = document.createElement('th'),
					th_srcip = document.createElement('th'),
					th_destip = document.createElement('th'),
					th_flag = document.createElement('th'),
					th_action = document.createElement('th');


				th_in_out.innerHTML = `In/Out`;
				th_order.innerHTML = 'Order';
				th_protocol.innerHTML = 'Protocol';
				th_srcip.innerHTML = 'Src IP';
				th_destip.innerHTML = 'Dest IP';
				th_flag.innerHTML = 'Flag';
				th_action.innerHTML = 'Action';
			
				$(thr).append(th_in_out, th_order, th_protocol, th_srcip, th_destip, th_flag, th_action).appendTo(thead);
				$(thead).appendTo(table);
				$(tbody).appendTo(table);
				$(table).appendTo(scrollbar);
				$(scrollbar).appendTo(ifTable);
				

				ifTable.id = eth;
				
				ifTable.classList.add('tab-pane');
				table.classList.add("table");
				table.classList.add("table-bordered");
				table.classList.add("table-hover");
				scrollbar.classList.add("scrollable");

				if ( ethCount === 0 ) {
					ifTab.classList.add('active');
					ifTable.classList.add('active');
				}


				$(ifTable).appendTo('#acl-table');
				$(ifTab).append(`<a data-toggle="tab" href="#${eth}" aria-expanded="true">${eth}</a>`).insertBefore('#modal-addtab-li');


				Object.keys(curIF).sort().forEach(function ( io, ioCount ) {
					curIF[io].forEach(function ( rule, ruleCount ) {
						let $tbody = $(`#${eth}`).find('tbody'),
							tbr = document.createElement('tr'),
							td_in_out = document.createElement('td'),
							td_order = document.createElement('td'),
							td_protocol = document.createElement('td'),
							td_srcip = document.createElement('td'),
							td_destip = document.createElement('td'),
							td_flag = document.createElement('td'),
							td_action = document.createElement('td');

						
						// console.log(rule);
						td_in_out.innerHTML = rule['in_out'];
						td_order.innerHTML = rule['ruleOrder'];
						td_protocol.innerHTML = rule['protocol'];
						td_action.innerHTML = rule['action'];
						td_srcip.innerHTML = rule['src_ip'];	// `${rule['src_ip']['ipaddrData']} / ${rule['src_ip']['maskData']}`;
						td_destip.innerHTML = rule['dest_ip'];	//	`${rule['dest_ip']['ipaddrData']} / ${rule['dest_ip']['maskData']}`;
						if ( rule['tcp_flags'].length === 0 ) {
							td_flag.innerHTML = 'ANY';
						} else if ( rule['tcp_flags'].length === 2 ) {
							if ( rule['tcp_flags'][0] === 'ACK' ) td_flag.innerHTML = `${rule['tcp_flags'][1]}+${rule['tcp_flags'][0]}`;
							else td_flag.innerHTML = `${rule['tcp_flags'][0]}+${rule['tcp_flags'][1]}`;
						} else td_flag.innerHTML = rule['tcp_flags'][0];

						$(tbr).append(td_in_out, td_order, td_protocol, td_srcip, td_destip, td_flag, td_action).appendTo($tbody);
					});
					
				});

				
				
				
			});



			$('.scrollable').each(function () {
				var $this = $(this);
				$(this).ace_scroll({
					size: $this.attr('data-size') || 400,
					//styleClass: 'scroll-left scroll-margin scroll-thin scroll-dark scroll-light no-track scroll-visible'
				});
			});



			// $(window).on('resize.scroll_reset', function() {
			// 	$('.scrollable-horizontal').ace_scroll('reset');
			// });



		}
	}
	

}

