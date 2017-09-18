"use strict";

const fs = require('fs');
const path = require('path');
const _ = require('underscore');
const {dialog} = require('electron').remote;
const topoUI = require( path.join(__dirname, 'topo-ui.js') );
const EARARTree = require( path.join(__dirname, 'enhanced-arar.js') );
// const ARARTree = require( path.join(__dirname, 'adaptive-rar.js') );
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
	let segmentMode = true;
	let useExchange = true;
	let initialLevel = 2;
	let interRuleList = [], fwCount = 0;
	myObject['topoPath'] = new myTopology(myObject.nodeDataArray, myObject.linkDataArray);

	Object.keys(myObject['aclObject']).forEach(function ( nodeName, nodeNameCount ) {
		if ( nodeName === 'interTree' ) return;
		let curNode = myObject['aclObject'][nodeName];
		if ( curNode['ruleList'].length === 0 ) return;

		curNode['ARARTree'] = new EARARTree(curNode['ruleList'], segmentMode, useExchange, initialLevel);
		
		for (var i = 0; i < curNode['ruleList'].length; i++) {
			interRuleList.push(curNode['ruleList'][i]);
		}
		// console.log(curNode);
		checkAnomaly(nodeName, curNode, segmentMode);

		fwCount++;
	});

	if ( fwCount > 1 ) {
		myObject['aclObject']['interTree'] = new InterTree(interRuleList);
		myObject['aclObject']['interTree']['ARARTree'] = new EARARTree(myObject['aclObject']['interTree']['ruleList'], segmentMode, useExchange, initialLevel);
		
		checkAnomaly('interTree', myObject['aclObject']['interTree'], segmentMode);
	}

	
	myObject.isInspect = true;
	depictResult();

	function checkAnomaly ( nodeName, node, segmentMode ) {
		node['ARARTree']['leafList'].forEach(function ( leaf, leafCount ) {
			if ( segmentMode ) {
				if ( leaf['flag'] ) {
					if ( leaf['ruleList'].length === 1 ) {
						// leaf['anomaly'] = new AnomalyObject(true, 'lost');
						leaf['anomaly'] = true;
					} else {
						for (let ruleCount=0; ruleCount<leaf['ruleList'].length; ruleCount++) {
							let rule = leaf['ruleList'][ruleCount];
							if ( rule['tcp_flags'].length === 0 ) continue;
							let flagChart = constructFlagChartOfRule(rule);
							leaf['anomaly'] = true;
						}
					}
				// } else {
				// 	leaf['anomaly'] = false;
				}
			}

			if ( leaf['anomaly'] ) { 
				return;
			} else {
				// checking is all action same
				// for (let i=0; i<leaf['ruleList'].length-1; i++) {
				// 	if ( leaf['ruleList'][i]['action'] !== leaf['ruleList'][i+1]['action'] ) {
				// 		leaf['anomaly'] = true;
				// 		break;
				// 	}
				// }

				// checking does lost rule
				let exist = 0, total = 0;
				let preAction, curAction;
				if ( nodeName !== 'interTree' ) {
					let routeObject = createRouteObject(leaf);
					
					leaf['ruleList'].forEach(function ( rule ) {
						// let itf = rule.interface.split('eth')[1];
						if ( routeObject[rule.interface.split('eth')[1]][rule.in_out] === undefined )
							routeObject[rule.interface.split('eth')[1]][rule.in_out] = rule.action;
					});

					Object.keys(routeObject).forEach(function ( itf ) {
						if ( itf === 'nodeName' ) return;
						Object.keys(routeObject[itf]).forEach(function ( io ) {
							if ( routeObject[itf][io] ) exist++;
							total++;

							preAction = curAction;
							curAction = routeObject[itf][io];
							if ( preAction ) {
								if ( preAction !== curAction ) {
									leaf['anomaly'] = true;
								}
							}
						});
					});

					if ( exist !== total ) {
						leaf['anomaly'] = true;
					}
					else {
						console.log(routeObject);
						console.log(leafCount, leaf);
					}
				} else if ( nodeName === 'interTree' ) {
					
				}


				if ( leaf['anomaly'] === undefined ) {
					// console.log(leaf);
					leaf['anomaly'] = false;
				}
			}
		});
	}

	function checkIsSubnet ( ipAddr, nwAddr ) {
		let nw_ip, nw_mask, nw_min_ip, nw_max_ip;
		// let ip_ip, ip_mask, ip_min_ip, ip_max_ip;
		[nw_ip, nw_mask] = nwAddr.split('/');
		nw_ip = ipConvertor(nw_ip);
		nw_mask = parseInt(nw_mask);
		nw_min_ip = nw_ip;
		nw_max_ip = nw_min_ip | (((1 << (32 - nw_mask)) - 1) >>> 0);

		if ( (ipAddr >= nw_min_ip) && (ipAddr <= nw_max_ip) )
			return true;
		return false;
	}

	function constructFlagChartOfRule ( rule ) {
		let flagChart;
		// console.log(rule);

		return flagChart;
	}

	function createRouteObject ( node ) {
		let routeObject = {};
		Object.keys(myObject.topoPath.routeTree).forEach(function ( from ) {
			if ( checkIsSubnet((node.parameter.rsvSrc | node.parameter.baseSrc) >>> 0, myObject.topoPath.nodeArray[from].address) ) { 
				Object.keys(myObject.topoPath.routeTree[from]).forEach(function ( to ) {
					if ( !checkIsSubnet((node.parameter.rsvDest | node.parameter.baseDest) >>> 0, myObject.topoPath.nodeArray[to].address) ) { return; }
					
					myObject.topoPath.routeTree[from][to].forEach(function ( curPath ) {
						curPath.forEach(function ( curNode ) {
							if ( curNode.nodeName === node.ruleList[0].nodeName ) {
								let nodeName = curNode.nodeName;
								let itf = curNode.interface;
								let io = curNode.in_out;
								routeObject['nodeName'] = nodeName;
								routeObject[itf] = routeObject[itf] || {};
								routeObject[itf][io] = undefined;
							}
						});
					});

				});
			} else if ( checkIsSubnet((node.parameter.rsvDest | node.parameter.baseDest) >>> 0, myObject.topoPath.nodeArray[from].address) ) {
				Object.keys(myObject.topoPath.routeTree[from]).forEach(function ( to ) {
					if ( !checkIsSubnet((node.parameter.rsvSrc | node.parameter.baseSrc) >>> 0, myObject.topoPath.nodeArray[to].address) ) { return; }
					
					myObject.topoPath.routeTree[from][to].forEach(function ( curPath ) {
						curPath.forEach(function ( curNode ) {
							if ( curNode.nodeName === node.ruleList[0].nodeName ) {
								let nodeName = curNode.nodeName;
								let itf = curNode.interface;
								let io = curNode.in_out;
								routeObject['nodeName'] = nodeName;
								routeObject[itf] = routeObject[itf] || {};
								routeObject[itf][io] = undefined;
							}
						});
					});

				});
			}
		});
		return routeObject;
	}

	function InterTree ( ruleList ) { this.nodeName = 'interTree'; this.ruleList = ruleList; this.ARARTree = undefined; }
	function AnomalyObject ( hasAnomaly=false, anomalyType=undefined ) { 
		this.hasAnomaly = hasAnomaly;
		if ( hasAnomaly ) this.anomalyType = anomalyType;
	}
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
		this.isInspect = false;
	} else {
		this.filepath = item.filepath;
		this.nodeDataArray = item.nodeDataArray;
		this.linkDataArray = item.linkDataArray;
		this.aclObject = item.aclObject;
		this.isInspect = item.isInspect;
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
		if ( this.isInspect ) depictResult();
	}

	
}



/*
 *	In initial of Programming, there is a new(blank) project been prepared.
 */
let myObject = new myThesisObject();

myObject.start();


$('button[id="clear-button"]').attr('type', 'button').on('click', function() {
	console.log('clear pressed');

	$('#chart-tabs').empty();
	$('#tab-content').empty();
	if ( !$('#page-body').hasClass('hidden') ) $('#page-body').addClass('hidden');
	myObject = new myThesisObject();
	myObject.update();
});

$('button[id="show-object"]').attr('type', 'button').on('click', function() {
	myObject.showObject();
});


function clickTest ( event ) {
	// console.log(event);
	let nodeName = (this.chart.renderTo.id).split('-')[1];
	let block = myObject['aclObject'][nodeName]['ARARTree']['leafList'][this.index];
	console.log(block);
	// this.index;
}


function depictResult () {
	if ( $('#page-body').hasClass('hidden') ) $('#page-body').removeClass('hidden');
	$('#chart-tabs').empty();
	$('#tab-content').empty();

	let showingNodeCount = 0;
	Object.keys(myObject['aclObject']).forEach(function ( nodeName, nodeNameCount ) {
		
		if ( !myObject['aclObject'][nodeName].hasOwnProperty('ARARTree') ) {
			showingNodeCount++;
			return;
		}
		let curNode = myObject['aclObject'][nodeName];
		let chartID = `chart-${nodeName}`;
		let $tab = `<li id="li-${nodeName}"><a data-toggle="tab" href="#tab-${nodeName}">${nodeName}</a></li>`;
		let $chart = `<div id="tab-${nodeName}" class="tab-pane fade"><div id="${chartID}" style="height:400px"></div></div>`;

		$($tab).appendTo('#chart-tabs');
		$($chart).appendTo('#tab-content');

		if ( nodeNameCount === showingNodeCount ) {
			$(`#tab-${nodeName}`).addClass('in active');
			$(`#li-${nodeName}`).addClass('active');
		}

		createHighcharts(chartID, curNode['ARARTree']['leafList']);
	});

	function createHighcharts ( chartID, dataList ) {
		let chart = {
			chart: { type: 'arearange', zoomType: 'xy'},
			title: { text: null },
			tooltip: { 
				followPointer: true,
				useHTML: true,
				headerFormat: `<div class="center" style="font-size: 14px; font-weight: bold">{series.name}</div></hr><div><table>`,
				footerFromat: '</table></div>',
				pointFormatter: function () {
					var str =	`<tr><td>Src:&#160;</td>\
									<td>${ipConvertor(this.series.xData[0])}</td>\
									<td>&#160;~&#160;</td>\
									<td>${ipConvertor(this.series.xData[1])}</td>\
								</tr>\
								<tr>\
									<td>Dest:&#160;</td>\
									<td>${ipConvertor(this.low)}</td>\
									<td>&#160;~&#160;</td>\
									<td>${ipConvertor(this.high)}</td>\
								</tr>`;
					
					return str;
				},
			},

			plotOptions: {
				series: {
					stickyTracking: false,
					trackByArea: true,
					showInLegend: false,
					fillOpacity: 0.5,
					lineWidth: 0.5,
					marker: { enabled: false, states: { hover: { enabled: false } } },
					cursor: 'pointer',
					events: { click: clickTest },
				}
			},
			xAxis: {
				title: "",
				labels: { formatter: function () { return ipConvertor(this.value); } },
				floor: 0,
				ceiling: 4294967295,
			},

			yAxis: {
				title: "",
				labels: { formatter: function () { return ipConvertor(this.value); } },
				floor: 0,
				ceiling: 4294967295,
			}
		};
		chart.series = createSeries(dataList);
		Highcharts.chart(chartID, chart);
	}
	
	function createSeries ( dataList ) {
		let seriesList = [];

		dataList.forEach(function ( data, dataCount ) {
			let series, xBase, yBase, xMin, xMax, yMin, yMax;
			let para = data['parameter'];
			let lvl = para['nodeLevel'];
			let maxMask = 32;

			xMin = ((~(1 << (maxMask - lvl)) & para['rsvSrc']) | para['baseSrc']) >>> 0;
			yMin = ((~(1 << (maxMask - lvl)) & para['rsvDest']) | para['baseDest']) >>> 0;
			xMax = ((((1 << (maxMask - lvl)) - 1) | para['rsvSrc']) | para['baseSrc']) >>> 0;
			yMax = ((((1 << (maxMask - lvl)) - 1) | para['rsvDest']) | para['baseDest']) >>> 0;

			series = { 
				name: `block ${dataCount}`, color: '#f45b5b',
				data: [{ x: xMin, low: yMin, high: yMax }, { x: xMax, low: yMin, high: yMax }],
			};
			if ( !data['anomaly'] ) { series.color = '#90ed7d'; }
			seriesList.push(series);
		});
		
		return seriesList;
	}
}


// $('#test-ip').val('123.321.456.654');
// $('#test-mask').val('10');

// console.log($('#test-ip').val())
// console.log($('#test-mask').val())


// $('#test-flag').val('SYN+ACK');
// console.log($('#test-flag').val())


$('#add-test').on('click', function () {
	console.log('add');
	$('#show-test').on('click', function () {
		console.log('show');
	});

});

$('#red-test').on('click', function () {
	console.log('red');
	$("#show-test").off("click");
});

