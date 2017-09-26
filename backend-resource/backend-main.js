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
const RuleObject = require('./acl-file-parser.js').RuleObject;



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

	let modalHTMLData = fs.readFileSync(`${__dirname}/templates/inspect-modal.html`, 'utf-8').toString();
	$(modalHTMLData).insertAfter('#main-container');

	let $modal = $('#inspect-modal');
	let $confirm = $('#modal-confirm-button');
	let doInspect = false;

	$modal.on('show.bs.modal', function () {

		$('#initlvl-spinner').ace_spinner({
			value: 1,
			min: 1,
			max: 4,
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
		if ( doInspect ) startToInspect();
	});

	$confirm.on('click', function () {
		myObject['inspInfo'] = {
			segmentMode: ($('input[name="segmod-radio"]:checked').val() === '1') ? true : false,
			initialLevel: document.getElementById('initlvl-spinner').value,
		};

		doInspect = true;
		$modal.modal('hide');
	});

	// start to show
	$modal.modal('show');

	

	function startToInspect () {
		let interRuleList = [], fwCount = 0;
		myObject['topoPath'] = new myTopology(myObject.nodeDataArray, myObject.linkDataArray);

		Object.keys(myObject['aclObject']).forEach(function ( nodeName, nodeNameCount ) {
			if ( nodeName === 'interTree' ) return;
			let curNode = myObject['aclObject'][nodeName];
			if ( curNode['ruleList'].length === 0 ) return;

			curNode['ARARTree'] = new EARARTree(curNode['ruleList'], myObject['inspInfo']['segmentMode'], true, ['initialLevel']);
			
			_.each(curNode['ruleList'], function ( rule, ruleIdx ) {
				let newRule = new RuleObject(
					interRuleList.length,
					rule.interface,
					rule.in_out,
					rule.src_ip,
					rule.dest_ip,
					rule.protocol,
					rule.src_port,
					rule.dest_port,
					rule.tcp_flags,
					rule.action);
				newRule['nodeName'] = rule['nodeName'];
				newRule['ruleOrder'] = rule['ruleOrder'];
				interRuleList.push(newRule);
			});

			// for (let i = 0; i < curNode['ruleList'].length; i++) {
			// 	let newRule = 
			// 	interRuleList.push(curNode['ruleList'][i]);
			// }
			// console.log(curNode);
			checkAnomaly(curNode);

			fwCount++;
		});

		if ( fwCount > 1 ) {
			myObject['aclObject']['interTree'] = new InterTree(interRuleList);
			myObject['aclObject']['interTree']['ARARTree'] = new EARARTree(myObject['aclObject']['interTree']['ruleList'],
			myObject['inspInfo']['segmentMode'], true, myObject['inspInfo']['initialLevel']);
			
			checkAnomaly(myObject['aclObject']['interTree']);
		}

		
		myObject.isInspect = true;
		depictResult();
	}


	function checkAnomaly ( node ) {
		node['ARARTree']['leafList'].forEach(function ( leaf, leafCount ) {
			leaf['routeObject'] = createRouteObject(leaf);
			leaf['anomalyInfo'] = {
				'anomaly': false,
				'shadowing': [],
				'redundancy': [],
				'lost': [],
				'conflict': [],
				'consistent': []
			};

			// if ( leafCount === 0 ) console.log(leaf)

			// if it is not interTree, delete all the other interface information
			if ( node.nodeName !== 'interTree' ) {
				_.each(leaf['routeObject'], function ( flagRoute, flagKey ) {
					_.each(flagRoute, function ( exchg, exchgKey ) {
						_.each(exchg, function ( route, routeIdx ) {
							_.each(route, function ( hop, hopKey ) {
								if ( !_.isEqual(hopKey.split('_')[0], node.nodeName) ) {
									delete route[hopKey];
								}
							});
							if ( _.isEmpty(exchg[routeIdx]) ) { exchg[routeIdx] = undefined }
						});
						flagRoute[exchgKey] = _.compact(flagRoute[exchgKey]);
					});
				});
			}

			// fill all the rule in the leafNode to routeObject
			if ( myObject['inspInfo']['segmentMode'] ) {
				_.each(leaf['ruleList'], function ( rule, ruleIdx ) {
					if ( rule['tcp_flags'].length === 0 ) {
						_.each(leaf['routeObject'], function ( flagRoute, flagKey ) {
							_.each(flagRoute[rule.isExchange], function ( route, routeIdx ) {
								if ( route.hasOwnProperty(`${rule.nodeName}_${rule.interface}_${rule.in_out}`) ) {
									route[`${rule.nodeName}_${rule.interface}_${rule.in_out}`]['ruleList'].push(rule);
								}
							});
						});
					} else if ( rule['tcp_flags'].length === 1 ) {
						_.each(leaf['routeObject'][rule.tcp_flags[0]][rule.isExchange], function ( route, routeIdx ) {
							if ( route.hasOwnProperty(`${rule.nodeName}_${rule.interface}_${rule.in_out}`) ) {
								route[`${rule.nodeName}_${rule.interface}_${rule.in_out}`]['ruleList'].push(rule);
							}
						});
					} else {
						let tcp_flags;
						if ( rule['tcp_flags'][0] === 'ACK' ) {
							tcp_flags = `${rule['tcp_flags'][1]}+${rule['tcp_flags'][0]}`;
						} else {
							tcp_flags = `${rule['tcp_flags'][0]}+${rule['tcp_flags'][1]}`;
						}
						_.each(leaf['routeObject'][tcp_flags][rule.isExchange], function ( route, routeIdx ) {
							if ( route.hasOwnProperty(`${rule.nodeName}_${rule.interface}_${rule.in_out}`) ) {
								route[`${rule.nodeName}_${rule.interface}_${rule.in_out}`]['ruleList'].push(rule);
							}
						});
					}
				});
			} else {
				_.each(leaf['ruleList'], function ( rule, ruleIdx ) {
					_.each(leaf['routeObject'], function ( flagRoute, flagKey ) {
						_.each(flagRoute[rule.isExchange], function ( route, routeIdx ) {
							if ( route.hasOwnProperty(`${rule.nodeName}_${rule.interface}_${rule.in_out}`) ) {
								route[`${rule.nodeName}_${rule.interface}_${rule.in_out}`]['ruleList'].push(rule);
							}
						});
					});
				});
			}

			// check anomaly of the leafNode by routeObject
			// check shadowing, redundancy, lost and conflict
			let anomalyLocate;
			_.each(leaf['routeObject'], function ( flagRoute, flagKey ) {
				_.each(flagRoute, function ( exchg, exchgKey ) {
					_.each(exchg, function ( route, routeIdx ) {
						route['sameAction'] = true;
						let hopKeyArray = Object.keys(route);

						_.each(route, function ( hop, hopKey ) {
							if ( (hopKey === 'sameAction') || (hopKey === 'action') ) return;
							hop['sameAction'] = true;

							if ( hop['ruleList'].length === 0 ) {
								hop['action'] = undefined;
								hop['sameAction'] = false;
								route['action'] = undefined;
								route['sameAction'] = false;
								leaf['anomalyInfo']['anomaly'] = true;
								leaf['anomalyInfo']['lost'].push([`${flagKey}-${exchgKey}-${routeIdx}-${hopKey}`]);
							} else {
								hop['action'] = hop['ruleList'][0]['action'];

								if ( hop['ruleList'].length > 1 ) {
									_.each(hop['ruleList'], function ( rule, ruleIdx ) {
										if ( ruleIdx !== 0 ) {
											anomalyLocate = [`${flagKey}-${exchgKey}-${routeIdx}-${hopKey}`];
											if ( rule['action'] !== hop['ruleList'][0]['action'] ) {
												// leaf['anomalyInfo']['anomaly'] = true;
												hop['sameAction'] = false;
												if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['shadowing']) ) {
													leaf['anomalyInfo']['shadowing'].push(anomalyLocate);
												}
											} else {
												if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['redundancy']) ) {
													leaf['anomalyInfo']['redundancy'].push(anomalyLocate);
												}
											}
										}
									});

									// if ( hop['sameAction'] === true ) {
									// 	// leaf['anomalyInfo']['anomaly'] = true;
									// 	leaf['anomalyInfo']['redundancy'].push(`${flagKey}-${exchgKey}-${routeIdx}-${hopKey}`);
									// }
								}
							}

							let hopKeyIdx = hopKeyArray.indexOf(hopKey);
							if ( hopKeyIdx !== 0 ) {
								if ( hop['action'] !== route[hopKeyArray[hopKeyIdx-1]]['action'] ) {
									route['action'] = undefined;
									route['sameAction'] = false;
									anomalyLocate = [`${flagKey}-${exchgKey}-${routeIdx}`];
									if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['conflict']) ) {
										leaf['anomalyInfo']['conflict'].push(anomalyLocate);
									}
									// leaf['anomalyInfo']['conflict'].push(`${flagKey}-${exchgKey}-${routeIdx}`);
								}
							}

						});	//	hop

						if ( route['sameAction'] === true ) {
							route['action'] = route[hopKeyArray[0]]['action'];
						}

					});	//	route
				});	//	exchg
			});	//	flagRoute
			// check consistent
			if ( myObject['inspInfo']['segmentMode'] ) {
				let exchgKeyArray = ['false', 'true', 'false'];
				let flagKeyArray = Object.keys(leaf['routeObject']);
				_.each(leaf['routeObject']['SYN'], function ( exchgS, exchgSKey ) {
					_.each(exchgS, function ( routeS, routeSIdx ) {
						if ( !routeS['sameAction'] ) return;
						let tarExchgSAKey = exchgKeyArray[exchgKeyArray.indexOf(exchgSKey) + 1];

						// check for SYN+ACK
						_.each(leaf['routeObject']['SYN+ACK'][tarExchgSAKey], function ( routeSA, routeSAIdx ) {
							if ( !routeSA['sameAction'] ) return;
							if ( routeSA['action'] === routeS['action'] ) {
								// check for ACK
								_.each(leaf['routeObject']['ACK']['false'], function ( routeAF, routeAFIdx ) {
									if ( !routeAF['sameAction'] )  return;
									_.each(leaf['routeObject']['ACK']['true'], function ( routeAT, routeATIdx ) {
										if ( !routeAT['sameAction'] )  return;
										if ( routeAF['action'] === routeAT['action'] ) {
											if ( routeAT['action'] === routeS['action'] ) {
												// check for FIN series
												_.each(leaf['routeObject']['FIN'], function ( exchgF, exchgFKey ) {
													_.each(exchgF, function ( routeF, routeFIdx ) {
														if ( !routeF['sameAction'] ) return;
														let tarExchgFAKey = exchgKeyArray[exchgKeyArray.indexOf(exchgFKey) + 1];
														
														_.each(leaf['routeObject']['FIN+ACK'][tarExchgFAKey], function ( routeFA, routeFAIdx ) {
															if ( !routeFA['sameAction'] ) return;
															if ( routeFA['action'] === routeF['action'] ) {
																if ( routeFA['action'] === routeS['action'] ) {
																	// check for RST
																	_.each(leaf['routeObject']['RST'], function ( exchgR, exchgRKey ) {
																		_.each(exchgR, function ( routeR, routeRIdx ) {
																			if ( !routeR['sameAction'] ) return;
																			if ( routeR['action'] === routeS['action'] ) {
																				let result = [];
																				result.push(`SYN-${exchgSKey}-${routeSIdx}`);
																				result.push(`SYN+ACK-${tarExchgSAKey}-${routeSAIdx}`);
																				result.push(`ACK-false-${routeAFIdx}`);
																				result.push(`ACK-true-${routeATIdx}`);
																				result.push(`FIN-${exchgFKey}-${routeFIdx}`);
																				result.push(`FIN+ACK-${tarExchgFAKey}-${routeFAIdx}`);
																				result.push(`RST-${exchgRKey}-${routeRIdx}`);
																				leaf['anomalyInfo']['consistent'].push(result);
																			} else {
																				anomalyLocate = []
																				anomalyLocate.push(`SYN-${exchgSKey}-${routeSIdx}`);
																				anomalyLocate.push(`SYN+ACK-${tarExchgSAKey}-${routeSAIdx}`);
																				anomalyLocate.push(`ACK-false-${routeAFIdx}`);
																				anomalyLocate.push(`ACK-true-${routeATIdx}`);
																				anomalyLocate.push(`FIN-${exchgFKey}-${routeFIdx}`);
																				anomalyLocate.push(`FIN+ACK-${tarExchgFAKey}-${routeFAIdx}`);
																				anomalyLocate.push(`RST-${exchgRKey}-${routeRIdx}`);
																				if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['conflict']) ) {
																					leaf['anomalyInfo']['conflict'].push(anomalyLocate);
																				}
																			}
																		});
																	});

																	_.each(leaf['routeObject']['RST']['false'], function ( routeRF, routeRFIdx ) {
																		if ( !routeRF['sameAction'] ) return;
																		_.each(leaf['routeObject']['RST']['true'], function ( routeRT, routeRTIdx ) {
																			if ( !routeRT['sameAction'] ) return;
																			if ( routeRF['action'] === routeRT['action'] ) {
																				if ( routeRF['action'] === routeS['action'] ) {
																					// add into consistent list
																					let result = [];
																					result.push(`SYN-${exchgSKey}-${routeSIdx}`);
																					result.push(`SYN+ACK-${tarExchgSAKey}-${routeSAIdx}`);
																					result.push(`ACK-false-${routeAFIdx}`);
																					result.push(`ACK-true-${routeATIdx}`);
																					result.push(`FIN-${exchgFKey}-${routeFIdx}`);
																					result.push(`FIN+ACK-${tarExchgFAKey}-${routeFAIdx}`);
																					result.push(`RST-false-${routeRFIdx}`);
																					result.push(`RST-true-${routeRTIdx}`);
																					leaf['anomalyInfo']['consistent'].push(result);
																				} else {
																					anomalyLocate = [];
																					anomalyLocate.push(`SYN-${exchgSKey}-${routeSIdx}`);
																					anomalyLocate.push(`SYN+ACK-${tarExchgSAKey}-${routeSAIdx}`);
																					anomalyLocate.push(`ACK-false-${routeAFIdx}`);
																					anomalyLocate.push(`ACK-true-${routeATIdx}`);
																					anomalyLocate.push(`FIN-${exchgFKey}-${routeFIdx}`);
																					anomalyLocate.push(`FIN+ACK-${tarExchgFAKey}-${routeFAIdx}`);
																					anomalyLocate.push(`RST-false-${routeRFIdx}`);
																					anomalyLocate.push(`RST-true-${routeRTIdx}`);
																					if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['conflict']) ) {
																						leaf['anomalyInfo']['conflict'].push(anomalyLocate);
																					}
																				}
																			} else {
																				anomalyLocate = [];
																				anomalyLocate.push(`RST-false-${routeRFIdx}`);
																				anomalyLocate.push(`RST-true-${routeRTIdx}`);
																				if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['conflict']) ) {
																					leaf['anomalyInfo']['conflict'].push(anomalyLocate);
																				}
																			}
																		});
																	});

																} else {
																	anomalyLocate = [];
																	anomalyLocate.push(`SYN-${exchgSKey}-${routeSIdx}`);
																	anomalyLocate.push(`SYN+ACK-${tarExchgSAKey}-${routeSAIdx}`);
																	anomalyLocate.push(`ACK-false-${routeAFIdx}`);
																	anomalyLocate.push(`ACK-true-${routeATIdx}`);
																	anomalyLocate.push(`FIN-${exchgFKey}-${routeFIdx}`);
																	anomalyLocate.push(`FIN+ACK-${tarExchgFAKey}-${routeFAIdx}`);
																	if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['conflict']) ) {
																		leaf['anomalyInfo']['conflict'].push(anomalyLocate);
																	}
																}
															} else {
																anomalyLocate = [];
																anomalyLocate.push(`FIN-${exchgFKey}-${routeFIdx}`);
																anomalyLocate.push(`FIN+ACK-${tarExchgFAKey}-${routeFAIdx}`);
																if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['conflict']) ) {
																	leaf['anomalyInfo']['conflict'].push(anomalyLocate);
																}
															}
														});

													});
												});


												_.each(leaf['routeObject']['FIN']['false'], function ( routeFF, routeFFIdx ) {
													if ( !routeFF['sameAction'] ) return;
													_.each(leaf['routeObject']['FIN']['true'], function ( routeFT, routeFTIdx ) {
														if ( !routeFT['sameAction'] ) return;
														if ( routeFF['action'] === routeFT['action'] ) {
															_.each(leaf['routeObject']['FIN+ACK']['false'], function ( routeFAF, routeFAFIdx ) {
																if ( !routeFAF['sameAction'] ) return;
																if ( routeFAF['action'] === routeFF['action'] ) {
																	_.each(leaf['routeObject']['FIN+ACK']['true'], function ( routeFAT, routeFATIdx ) {
																		if ( !routeFAT['sameAction'] ) return;
																		if ( routeFAT['action'] === routeFAF['action'] ) {
																			if ( routeFAF['action'] === routeS['action'] ) {
																				// check for RST
																				// fix me
																				_.each(leaf['routeObject']['RST'], function ( exchgR, exchgRKey ) {
																					_.each(exchgR, function ( routeR, routeRIdx ) {
																						if ( !routeR['sameAction'] ) return;
																						if ( routeR['action'] === routeS['action'] ) {
																							let result = [];
																							result.push(`SYN-${exchgSKey}-${routeSIdx}`);
																							result.push(`SYN+ACK-${tarExchgSAKey}-${routeSAIdx}`);
																							result.push(`ACK-false-${routeAFIdx}`);
																							result.push(`ACK-true-${routeATIdx}`);
																							result.push(`FIN-false-${routeFFIdx}`);
																							result.push(`FIN-true-${routeFTIdx}`);
																							result.push(`FIN+ACK-false-${routeFAFIdx}`);
																							result.push(`FIN+ACK-true-${routeFATIdx}`);
																							result.push(`RST-${exchgRKey}-${routeRIdx}`);
																							leaf['anomalyInfo']['consistent'].push(result);
																						} else {
																							anomalyLocate = [];
																							anomalyLocate.push(`SYN-${exchgSKey}-${routeSIdx}`);
																							anomalyLocate.push(`SYN+ACK-${tarExchgSAKey}-${routeSAIdx}`);
																							anomalyLocate.push(`ACK-false-${routeAFIdx}`);
																							anomalyLocate.push(`ACK-true-${routeATIdx}`);
																							anomalyLocate.push(`FIN-false-${routeFFIdx}`);
																							anomalyLocate.push(`FIN-true-${routeFTIdx}`);
																							anomalyLocate.push(`FIN+ACK-false-${routeFAFIdx}`);
																							anomalyLocate.push(`FIN+ACK-true-${routeFATIdx}`);
																							anomalyLocate.push(`RST-${exchgRKey}-${routeRIdx}`);
																							if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['conflict']) ) {
																								leaf['anomalyInfo']['conflict'].push(anomalyLocate);
																							}
																						}
																					});
																				});

																				_.each(leaf['routeObject']['RST']['false'], function ( routeRF, routeRFIdx ) {
																					if ( !routeRF['sameAction'] ) return;
																					_.each(leaf['routeObject']['RST']['true'], function ( routeRT, routeRTIdx ) {
																						if ( !routeRT['sameAction'] ) return;

																						if ( routeRF['action'] === routeRT['action'] ) {
																							if ( routeRF['action'] === routeS['action'] ) {
																								// add into consistent list
																								let result = [];
																								result.push(`SYN-${exchgSKey}-${routeSIdx}`);
																								result.push(`SYN+ACK-${tarExchgSAKey}-${routeSAIdx}`);
																								result.push(`ACK-false-${routeAFIdx}`);
																								result.push(`ACK-true-${routeATIdx}`);
																								result.push(`FIN-false-${routeFFIdx}`);
																								result.push(`FIN-true-${routeFTIdx}`);
																								result.push(`FIN+ACK-false-${routeFAFIdx}`);
																								result.push(`FIN+ACK-true-${routeFATIdx}`);
																								result.push(`RST-false-${routeRFIdx}`);
																								result.push(`RST-true-${routeRTIdx}`);
																								leaf['anomalyInfo']['consistent'].push(result);
																							} else {
																								anomalyLocate = [];
																								anomalyLocate.push(`SYN-${exchgSKey}-${routeSIdx}`);
																								anomalyLocate.push(`SYN+ACK-${tarExchgSAKey}-${routeSAIdx}`);
																								anomalyLocate.push(`ACK-false-${routeAFIdx}`);
																								anomalyLocate.push(`ACK-true-${routeATIdx}`);
																								anomalyLocate.push(`FIN-false-${routeFFIdx}`);
																								anomalyLocate.push(`FIN-true-${routeFTIdx}`);
																								anomalyLocate.push(`FIN+ACK-false-${routeFAFIdx}`);
																								anomalyLocate.push(`FIN+ACK-true-${routeFATIdx}`);
																								anomalyLocate.push(`RST-false-${routeRFIdx}`);
																								anomalyLocate.push(`RST-true-${routeRTIdx}`);
																								if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['conflict']) ) {
																									leaf['anomalyInfo']['conflict'].push(anomalyLocate);
																								}
																							}
																						} else {
																							anomalyLocate = [];
																							anomalyLocate.push(`RST-false-${routeRFIdx}`);
																							anomalyLocate.push(`RST-true-${routeRTIdx}`);
																							if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['conflict']) ) {
																								leaf['anomalyInfo']['conflict'].push(anomalyLocate);
																							}
																						}
																					});
																				});


																			} else {
																				anomalyLocate = [];
																				anomalyLocate.push(`SYN-${exchgSKey}-${routeSIdx}`);
																				anomalyLocate.push(`SYN+ACK-${tarExchgSAKey}-${routeSAIdx}`);
																				anomalyLocate.push(`ACK-false-${routeAFIdx}`);
																				anomalyLocate.push(`ACK-true-${routeATIdx}`);
																				anomalyLocate.push(`FIN-false-${routeFFIdx}`);
																				anomalyLocate.push(`FIN-true-${routeFTIdx}`);
																				anomalyLocate.push(`FIN+ACK-false-${routeFAFIdx}`);
																				anomalyLocate.push(`FIN+ACK-true-${routeFATIdx}`);
																				if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['conflict']) ) {
																					leaf['anomalyInfo']['conflict'].push(anomalyLocate);
																				}
																			}
																		} else {
																			anomalyLocate = [];
																			anomalyLocate.push(`FIN-false-${routeFFIdx}`);
																			anomalyLocate.push(`FIN-true-${routeFTIdx}`);
																			anomalyLocate.push(`FIN+ACK-false-${routeFAFIdx}`);
																			anomalyLocate.push(`FIN+ACK-true-${routeFATIdx}`);
																			if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['conflict']) ) {
																				leaf['anomalyInfo']['conflict'].push(anomalyLocate);
																			}
																		}
																	});
																} else {
																	anomalyLocate = [];
																	anomalyLocate.push(`FIN-false-${routeFFIdx}`);
																	anomalyLocate.push(`FIN-true-${routeFTIdx}`);
																	anomalyLocate.push(`FIN+ACK-false-${routeFAFIdx}`);
																	if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['conflict']) ) {
																		leaf['anomalyInfo']['conflict'].push(anomalyLocate);
																	}
																}
															});
														} else {
															anomalyLocate = [];
															anomalyLocate.push(`FIN-false-${routeFFIdx}`);
															anomalyLocate.push(`FIN-true-${routeFTIdx}`);
															if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['conflict']) ) {
																leaf['anomalyInfo']['conflict'].push(anomalyLocate);
															}
														}

													});
												});


											} else {
												anomalyLocate = [];
												anomalyLocate.push(`SYN-${exchgSKey}-${routeSIdx}`);
												anomalyLocate.push(`SYN+ACK-${tarExchgSAKey}-${routeSAIdx}`);
												anomalyLocate.push(`ACK-false-${routeAFIdx}`);
												anomalyLocate.push(`ACK-true-${routeATIdx}`);
												if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['conflict']) ) {
													leaf['anomalyInfo']['conflict'].push(anomalyLocate);
												}
											}
										} else {
											anomalyLocate = [];
											anomalyLocate.push(`ACK-false-${routeAFIdx}`);
											anomalyLocate.push(`ACK-true-${routeATIdx}`);
											if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['conflict']) ) {
												leaf['anomalyInfo']['conflict'].push(anomalyLocate);
											}
										}
									});
								});

							} else {
								anomalyLocate = [];
								anomalyLocate.push(`SYN-${exchgSKey}-${routeSIdx}`);
								anomalyLocate.push(`SYN+ACK-${tarExchgSAKey}-${routeSAIdx}`);
								if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['conflict']) ) {
									leaf['anomalyInfo']['conflict'].push(anomalyLocate);
								}
							}
						});
						
					}); //	exchgS
				});

				// anomalyLocate = `ANY-false-${routeFIdx},ANY-true-${routeTIdx}`;
				// if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['conflict']) ) {
				// 	leaf['anomalyInfo']['conflict'].push(anomalyLocate);
				// }

				if ( leaf['anomalyInfo']['consistent'].length === 0 ) {
					leaf['anomalyInfo']['anomaly'] = true;
				}
			} else {
				_.each(leaf['routeObject']['ANY']['false'], function ( routeF, routeFIdx ) {
					if ( routeF['sameAction'] ) {
						_.each(leaf['routeObject']['ANY']['true'], function ( routeT, routeTIdx ) {
							if ( routeT['sameAction'] ) {
								if ( routeF['action'] === routeT['action'] ) {
									leaf['anomalyInfo']['consistent'].push([`ANY-false-${routeFIdx}`, `ANY-true-${routeTIdx}`]);
								} else {
									anomalyLocate = [`ANY-false-${routeFIdx}`, `ANY-true-${routeTIdx}`];
									if ( !checkElementIsExistInArray(anomalyLocate, leaf['anomalyInfo']['conflict']) ) {
										leaf['anomalyInfo']['conflict'].push(anomalyLocate);
									}
								}
							}
						});
					}
				});

				if ( leaf['anomalyInfo']['consistent'].length === 0 ) {
					leaf['anomalyInfo']['anomaly'] = true;
				}
			}
		});
	}

	function createRouteObject ( node ) {
		let routeObject;
		if ( myObject['inspInfo']['segmentMode'] ) {
			routeObject = {
				'SYN': undefined,
				'SYN+ACK': undefined,
				'ACK': undefined,
				'FIN': undefined,
				'FIN+ACK': undefined,
				'RST': undefined,
			};
		} else {
			routeObject = { 'ANY': undefined };
		}

		_.each(routeObject, function ( flagRoute, flagKey ) {
			routeObject[flagKey] = createRouteList(node);
		});
		return routeObject;
	}

	function createRouteList ( node ) {
		let flagRoute = { false: [], true: [] };
		_.each(myObject.topoPath.routeTree, function ( from, fromKey ) {
			if ( checkIsSubnet((node.parameter.rsvSrc | node.parameter.baseSrc) >>> 0, myObject.topoPath.nodeArray[fromKey].address) ) {
				_.each(from, function ( to, toKey ) {
					if ( checkIsSubnet((node.parameter.rsvDest | node.parameter.baseDest) >>> 0, myObject.topoPath.nodeArray[toKey].address) ) {
						_.each(to, function ( path ) {
							let route = {};
							_.each(path, function ( hop, hopIdx ) {
								if ( (hopIdx === 0) || (hopIdx === (path.length - 1)) ) return;
								let fw = hop.nodeName;
								let eth = `eth${hop.interface}`;
								let io = hop.in_out;
								route[`${fw}_${eth}_${io}`] = route[`${fw}_${eth}_${io}`] || { ruleList: [] };
							});
							flagRoute['false'].push(route);
						});
					}
				});
			} else if ( checkIsSubnet((node.parameter.rsvDest | node.parameter.baseDest) >>> 0, myObject.topoPath.nodeArray[fromKey].address) ) {
				_.each(from, function ( to, toKey ) {
					if ( checkIsSubnet((node.parameter.rsvSrc | node.parameter.baseSrc) >>> 0, myObject.topoPath.nodeArray[toKey].address) ) {
						_.each(to, function ( path ) {
							let route = {};
							_.each(path, function ( hop, hopIdx ) {
								if ( (hopIdx === 0) || (hopIdx === (path.length - 1)) ) return;
								let fw = hop.nodeName;
								let eth = `eth${hop.interface}`;
								let io = hop.in_out;
								route[`${fw}_${eth}_${io}`] = route[`${fw}_${eth}_${io}`] || { ruleList: [] };
							});
							flagRoute['true'].push(route);
						});
					}
				});
			}
		});
		return flagRoute;
	}


	/*
	function checkAnomaly ( node ) {
		node['ARARTree']['leafList'].forEach(function ( leaf, leafCount ) {
			leaf['routeList'] = createRouteList(leaf);

			if ( myObject['inspInfo']['segmentMode'] ) {
				// if it is not interTree, delete all the other interface information
				if ( node.nodeName !== 'interTree' ) {
					_.each(leaf['routeList'], function ( route, routeIdx ) {
						_.each(route, function ( exchg, exchgKey ) {
							_.each(exchg, function ( fw, fwKey ) {
								if ( fwKey !== node.nodeName ) { delete exchg[fwKey]; }
							});
							if ( _.isEmpty(route[exchgKey]) ) { delete route[exchgKey]; }
						});
						if ( _.isEmpty(route) ) { leaf['routeList'][routeIdx] = undefined; }
					});
					leaf['routeList'] = _.compact(leaf['routeList']);
				}

				// change routeList to flag inspect mode
				_.each(leaf['routeList'], function ( route, routeIdx ) {
					_.each(route, function ( exchg, exchgKey ) {
						_.each(exchg, function ( fw, fwKey ) {
							_.each(fw, function ( eth, ethKey ) {
								_.each(eth, function ( io, ioKey ) {
									eth[ioKey] = {'SYN': [], 'SYN+ACK': [], 'ACK': [], 'FIN': [], 'FIN+ACK': [], 'RST': [], };
								});
							});
						});
					});
				});

				// fill all the rule in the leafNode to routeList
				_.each(leaf['ruleList'], function ( rule , ruleIdx ) {
					_.each(leaf['routeList'], function ( route, routeIdx ) {
						if ( route[rule.isExchange].hasOwnProperty(rule.nodeName) ) {
							let fw = route[rule.isExchange][rule.nodeName];
							if ( fw.hasOwnProperty(rule.interface) ) {
								let eth = fw[rule.interface];
								if ( eth.hasOwnProperty(rule.in_out) ) {
									let io = eth[rule.in_out];
									if ( rule.tcp_flags.length > 1 ) {
										let tcp_flags;
										if ( rule.tcp_flags[0] === 'ACK' ) {
											tcp_flags = `${rule.tcp_flags[1]}+${rule.tcp_flags[0]}`;
										} else if ( rule.tcp_flags[1] === 'ACK' ) {
											tcp_flags = `${rule.tcp_flags[0]}+${rule.tcp_flags[1]}`;
										}
										io[tcp_flags].push(rule);
									} else if ( rule.tcp_flags.length === 1 ) {
										io[rule.tcp_flags[0]].push(rule);
									} else {
										_.each(io, function ( tcp_flags ) { tcp_flags.push(rule); });
									}
								}
							}
						}
					});
				});

				// check anomaly of the leafNode by routeList
				if ( leaf['ruleList'].length === 1 ) {
					leaf['anomaly'] = true;
				} else {

					_.each(leaf['routeList'], function ( route, routeIdx ) {
						let preActoin;
						_.each(route, function ( exchg, exchgKey ) {
							_.each(exchg, function ( fw, fwKey ) {
								_.each(fw, function ( eth, ethKey ) {
									_.each(eth, function ( io, ioKey ) {
										_.each(io, function ( flag, flagKey ) {




											if ( flag.length === 0 ) {
												leaf['anomaly'] = true;
												return;
											} else {
												if ( preActoin === undefined ) {
													preActoin = flag[0].action;
												} else {
													if ( !_.isEqual(flag[0].action, preActoin) ) {
														leaf['anomaly'] = true;
														return;
													}
												}

												if ( flag.length > 1 ) {
													let preRuleAction;
													_.each(flag, function ( rule, ruleIdx ) {
														if ( preRuleAction === undefined ) {
															preRuleAction = rule['action'];
														} else {
															if ( !_.isEqual(rule['action'], preRuleAction) ) { 
																leaf['anomaly'] = true;
															}
														}
													});
												}
											}




											
										}); //	flag
									}); //	io
								}); //	eth
							}); //	fw
						}); //	exchg
					}); //	route

					// console.log(leaf);
				}
				
			} else {
				// if it is not interTree, delete all the other interface information
				if ( node.nodeName !== 'interTree' ) {
					_.each(leaf['routeList'], function ( route, routeIdx ) {
						_.each(route, function ( exchg, exchgKey ) {
							_.each(exchg, function ( fw, fwKey ) {
								if ( fwKey !== node.nodeName ) { delete exchg[fwKey]; }
							});
							if ( _.isEmpty(route[exchgKey]) ) { delete route[exchgKey]; }
						});
						if ( _.isEmpty(route) ) { leaf['routeList'][routeIdx] = undefined; }
					});
					leaf['routeList'] = _.compact(leaf['routeList']);
				}

				// fill all the rule in the leafNode to routeList
				_.each(leaf['ruleList'], function ( rule , ruleIdx ) {
					_.each(leaf['routeList'], function ( route, routeIdx ) {

						if ( route[rule.isExchange].hasOwnProperty(rule.nodeName) ) {
							let fw = route[rule.isExchange][rule.nodeName];
							if ( fw.hasOwnProperty(rule.interface) ) {
								let eth = fw[rule.interface];
								if ( eth.hasOwnProperty(rule.in_out) ) {
									let io = eth[rule.in_out];
									io.push(rule);
								}
							}
						}

					});
				});

				// check anomaly of the leafNode by routeList
				if ( leaf['ruleList'].length === 1 ) {
					leaf['anomaly'] = true;
				} else {
					_.each(leaf['routeList'], function ( route, routeIdx ) {
						let preActoin;
						_.each(route, function ( exchg, exchgKey ) {
							_.each(exchg, function ( fw, fwKey ) {
								_.each(fw, function ( eth, ethKey ) {
									_.each(eth, function ( io, ioKey ) {
										
										if ( io.length === 0 ) {
											leaf['anomaly'] = true;
										} else {
											if ( preActoin === undefined ) {
												preActoin = io[0].action;
											} else {
												if ( !_.isEqual(io[0].action, preActoin) ) {
													leaf['anomaly'] = true;
													return;
												}
											}

											if ( io.length > 1 ) {
												let preRuleAction;
												_.each(io, function ( rule, ruleIdx ) {
													if ( preRuleAction === undefined ) {
														preRuleAction = rule['action'];
													} else {
														if ( !_.isEqual(rule['action'], preRuleAction) ) { 
															leaf['anomaly'] = true;
														}
													}
												});
											}
										}

									});
								});
							});
						});
					});
				}
			}
		});
	}

	function createRouteList ( node ) {
		let routeList = [];
		Object.keys(myObject.topoPath.routeTree).forEach(function ( from ) {
			if ( checkIsSubnet((node.parameter.rsvSrc | node.parameter.baseSrc) >>> 0, myObject.topoPath.nodeArray[from].address) ) {
				Object.keys(myObject.topoPath.routeTree[from]).forEach(function ( to ) {
					if ( checkIsSubnet((node.parameter.rsvDest | node.parameter.baseDest) >>> 0, myObject.topoPath.nodeArray[to].address) ) {
						myObject.topoPath.routeTree[from][to].forEach(function ( path ) {
							let routeObject = { false: {}, true: {} };
							path.forEach(function ( hop, hopCount ) {
								if ( (hopCount === 0) || (hopCount === (path.length - 1)) ) return;
								let fw = hop.nodeName,
									eth = `eth${hop.interface}`,
									io = hop.in_out,
									exio;

								if ( io === 'INPUT' ) { exio = 'OUTPUT'; }
								else if ( io === 'OUTPUT' ) { exio = 'INPUT'; }
								routeObject['false'][fw] = routeObject['false'][fw] || {};
								routeObject['false'][fw][eth] = routeObject['false'][fw][eth] || {};
								routeObject['false'][fw][eth][io] = [];
								routeObject['true'][fw] = routeObject['true'][fw] || {};
								routeObject['true'][fw][eth] = routeObject['true'][fw][eth] || {};
								routeObject['true'][fw][eth][exio] = [];
							});
							routeList.push(routeObject);
						});
					}
				});
			}
		});
		return routeList;
	}*/


	function checkIsSubnet ( ipAddr, nwAddr ) {
		let nw_ip, nw_mask, nw_min_ip, nw_max_ip;
		[nw_ip, nw_mask] = nwAddr.split('/');
		nw_ip = ipConvertor(nw_ip);
		nw_mask = parseInt(nw_mask);
		nw_min_ip = nw_ip;
		nw_max_ip = nw_min_ip | (((1 << (32 - nw_mask)) - 1) >>> 0);

		if ( (ipAddr >= nw_min_ip) && (ipAddr <= nw_max_ip) ) { return true; }
		return false;
	}

	function InterTree ( ruleList ) { this.nodeName = 'interTree'; this.ruleList = ruleList; this.ARARTree = undefined; }
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


function createAnomalyChart ( event ) {
	// console.log(event);
	let nodeName = (this.chart.renderTo.id).split('-')[1];
	let block = myObject['aclObject'][nodeName]['ARARTree']['leafList'][this.index];
	// console.log(this.index, this, block);
	console.log(this.index, block);


	$(`#tab-${nodeName} div#block-content`).empty();
	let $chart = fs.readFileSync(`${__dirname}/templates/block-information.html`, 'utf-8').toString();
	$($chart).appendTo(`#tab-${nodeName} div#block-content`);


	$(`#tab-${nodeName} span#src-range`).text(`${ipConvertor(this.xData[0])} / ${block['parameter']['nodeLevel'] - 1}`);
	$(`#tab-${nodeName} span#dest-range`).text(`${ipConvertor(this.yData[0][0])} / ${block['parameter']['nodeLevel'] - 1}`);
	$(`<table id="path-table" class="table table-bordered table-hover"></table>`).appendTo(`#tab-${nodeName} div#path-data`);

	_.each(block['routeObject'], function ( flagRoute, flagKey ) {
		let flagKeyID;
		if ( flagKey.split('+').length > 1 ) {
			flagKeyID = flagKey.split('+').join('-');
		} else {
			flagKeyID = flagKey;
		}
		_.each(flagRoute, function ( exchg, exchgKey ) {
			let thead = `<thead><tr><td><div class="row">
							<div class="col-xs-5"> <span id="span-left" style="float: right;"> </span> </div>
							<div class="col-xs-2"> ${flagKey} </div>
							<div class="col-xs-5"> <span id="span-right" style="float: left;"> </span> </div>
						</div></td></tr></thead>`;
			$(thead).appendTo(`#tab-${nodeName} table#path-table`);
			let tbody = document.createElement('tbody');
			tbody.id = flagKeyID;
			$(tbody).appendTo(`#tab-${nodeName} table#path-table`);
			
			_.each(exchg, function ( route, routeIdx ) {
				let routeTitle = [];

				_.each(route, function ( hop, hopKey ) {
					if ( (hopKey === 'sameAction') || (hopKey === 'action') ) return;
					let [fw, eth, io] = hopKey.split('_');
					routeTitle.push(`${fw}(${eth})`);
				});

				let routeHeader, routeID = `${flagKeyID}-${exchgKey}-${routeIdx}`;
				if( exchgKey === 'false' ) {
					routeHeader = `<tr> <td class="center"> <span class="action-buttons" style="float: left;"> 
					<a href="#" id="${routeID}" class="show-details-btn" title="Show Details">
					<i class="ace-icon fa fa-plus-square-o"></i> </a> </span>
					${ routeTitle.join('  <i class="ace-icon fa fa-long-arrow-right"></i>  ')}  </td> </tr>`;
				} else {
					routeHeader = `<tr> <td class="center"> <span class="action-buttons" style="float: left;"> 
					<a href="#" id="${routeID}" class="show-details-btn" title="Show Details">
					<i class="ace-icon fa fa-plus-square-o"></i> </a> </span>
					${ routeTitle.join('  <i class="ace-icon fa fa-long-arrow-left"></i>  ')} </td> </tr>`;
				}
				let routeBody = `<tr class="detail-row"> <td colspan="8"> <div class="table-detail">
				<table class="table table-bordered table-hover"> <thead> <tr id="thead-${routeID}"> </tr> </thead>
				<tbody id="tbody-${routeID}"> </tbody> </table> </div> </td> </tr>`;

				$(tbody).append(routeHeader, routeBody);

				let hopKeyArray = Object.keys(route);
				_.each(route, function ( hop, hopKey ) {
					if ( (hopKey === 'sameAction') || (hopKey === 'action') ) return;
					let [fw, eth, io] = hopKey.split('_');
					$(`<td>${fw}<br>${eth}<br>${io}</td>`).appendTo(`#tab-${nodeName} tr#thead-${routeID}`);

					_.each(hop['ruleList'], function ( rule, ruleIdx ) {
						let ruleTR = $(`#tab-${nodeName} tbody#tbody-${routeID}`).children()[ruleIdx];
						if ( !ruleTR ) {
							ruleTR = document.createElement('tr');
							$(ruleTR).appendTo(`#tab-${nodeName} tbody#tbody-${routeID}`);
						}


						let ruleColor = '#90ed7d';
						if ( rule.action === 'DROP' ) { ruleColor = '#f45b5b'; }

						for (let i=0; i<=hopKeyArray.indexOf(hopKey); i++) {
							let ruleTD;
							if ( i !== hopKeyArray.indexOf(hopKey) ) {
								ruleTD = $(ruleTR).children()[i];
								// console.log(ruleTD);
								if ( !ruleTD ) {
									ruleTD = `<td></td>`;
									$(ruleTD).appendTo(ruleTR);
								}
							} else {
								ruleTD = `<td style="background-color: ${ruleColor}">${rule.ruleOrder}</td>`;
								$(ruleTD).appendTo(ruleTR);
							}
						}


					});
				});
			});

		});
	});

	for (let i=0; i<10; i++) {
		$(`#tab-${nodeName} span#span-left`).each(function ( idx ) {
			if ( (idx % 2) === 0 ) {
				$(this).append(`<i class="ace-icon fa fa-long-arrow-right"></i>`);
			} else {
				$(this).append(`<i class="ace-icon fa fa-long-arrow-left"></i>`);
			}
			
		});
		$(`#tab-${nodeName} span#span-right`).each(function ( idx ) {
			if ( (idx % 2) === 0 ) {
				$(this).append(`<i class="ace-icon fa fa-long-arrow-right"></i>`);
			} else {
				$(this).append(`<i class="ace-icon fa fa-long-arrow-left"></i>`);
			}
		});
	}

	$('.show-details-btn').on('click', function(e) {
		// console.log('test in block');
		e.preventDefault();
		$(this).closest('tr').next().toggleClass('open');
		$(this).find(ace.vars['.icon']).toggleClass('fa-plus-square-o').toggleClass('fa-minus-square-o');
	});

	// $(`#tab-${nodeName} div#anomaly-body`).accordion({ collapsible: true, heightStyle: "content", animate: 250, header: ".accordion-header"});

	$(`#tab-${nodeName} ul#anomaly-tree`).shieldTreeView({
		events: { select: anomalySelectHandler },
		dataSource: { data: convertAnomalyInfo(block['anomalyInfo']) },
	});
	// this.index;
	function convertAnomalyInfo ( obj ) {
		let dataList = [];

		_.each(obj, function ( typeData, typeName ) {
			if ( typeName === 'anomaly' ) return;
			
			let anomalyList = new AnomalyTreeData(`${typeName} (${typeData.length})`, true);
			
			if ( typeData.length === 0 ) {
				anomalyList['items'].push(new AnomalyTreeData('null', false, true));
			} else {
				_.each(typeData, function ( anomalyData, anomalyIdx ) {
					anomalyList['items'].push(new AnomalyTreeData(anomalyData));
				});
			}

			dataList.push(anomalyList);
		});

		return dataList;
		console.log(dataList);
	}

	function AnomalyTreeData ( name, hasChildren=false, doDisable=false ) {
		this.text = name;
		if ( hasChildren ) { this.items = []; }
		if ( doDisable ) { this.disabled = true; }
	}
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
		// let $chart = `<div id="tab-${nodeName}" class="tab-pane fade"><div id="${chartID}" style="height:400px"></div></div>`;
		let $chart = `<div id="tab-${nodeName}" class="tab-pane fade">
					<div class="row"> <div class="col-xs-12"> <div id="${chartID}" style="height:400px"></div> </div> </div>
					<div class="row"> <div class="col-xs-12" id="block-content"></div> </div>
					</div>`;

		$($tab).appendTo('#chart-tabs');
		$($chart).appendTo('#tab-content');

		if ( nodeNameCount === showingNodeCount ) {
			$(`#tab-${nodeName}`).addClass('in active');
			$(`#li-${nodeName}`).addClass('active');
		}

		createHighcharts(chartID, curNode['ARARTree']['leafList']);
	});
	// $( "#tabs" ).tabs();

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
					events: { click: createAnomalyChart },
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
			if ( !data['anomalyInfo']['anomaly'] ) { series.color = '#90ed7d'; }
			seriesList.push(series);
		});
		
		return seriesList;
	}
}





// $( "#accordion" ).accordion({ collapsible: true, heightStyle: "content", animate: 250, header: ".accordion-header" })
// .sortable({ axis: "y", handle: ".accordion-header", stop: function( event, ui ) { ui.item.children(".accordion-header").triggerHandler("focusout"); } });



function anomalySelectHandler ( e ) {
	// console.log('something select');
	// console.log(e);
	let $target = e.element[0].textContent;
	if ( $target !== $target.split(' ')[0] ) {
		// console.log('not anomaly', $target.split(' ')[0]);
		$(e.element[0].firstChild.firstChild).click();
	} else {
		// console.log($target);
		$('tr.open').removeClass('open');
		let targetArray = $target.split(',');

		_.each(targetArray, function ( val, idx ) {
			let [flagKey, exchgKey, routeIdx, hopKey] = val.split('-');

			if ( flagKey.split('+').length > 1 ) {
				flagKey = flagKey.split('+').join('-');
			}
			let targetId = `${flagKey}-${exchgKey}-${routeIdx}`;
			console.log(targetId);
			$(`#${targetId}`).click();
		});


	}
	
	// // console.log( $(`#${targetId}-h`).attr('aria-expanded') );
	// // console.log( typeof $(`#${targetId}-h`).attr('aria-expanded') );


	// if ( $(`#${targetId}-h`).attr('aria-expanded') === 'false' ) {
	// 	$(`#${targetId}-h`).click();
	// }


}

// $("#anomaly-tree").shieldTreeView({
// 	// dragDrop: true,
// 	// checkboxes: {
// 	// 	enabled: true,
// 	// 	children: true
// 	// },
// 	events: { select: anomalySelectHandler },

// 	dataSource: {
// 		data: [
// 			{ text: 'shadowing', items: [
// 				{ text: 'node1', items: [
// 					{ text: 'test1', disabled: true },
// 					{ text: 'test2' },
// 					{ text: 'test3' }
// 				] },
// 				{ text: 'node2' },
// 				{ text: 'node3' }
// 			] },
// 			{ text: 'redundancy' },
// 			{ text: 'lost' },
// 			{ text: 'conflict' }
// 		]
// 	}
// 	// dataSource : {
// 	// 	// data: treeview_data
// 	// }
// });



// $('.show-details-btn').on('click', function(e) {
// 	console.log('test');
// 	e.preventDefault();
// 	$(this).closest('tr').next().toggleClass('open');
// 	$(this).find(ace.vars['.icon']).toggleClass('fa-plus-square-o').toggleClass('fa-minus-square-o');
// });