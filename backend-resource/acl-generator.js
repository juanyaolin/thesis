const ACLObject = require(`${__dirname}/backend-resource/acl-file-parser.js`);

function ruleGenerator ( aclObject, geneInfo, ruleNumber=10 ) {
	// console.log(aclObject);
	// console.log(geneInfo);
	

	Object.keys(geneInfo).sort().forEach(function ( curNode ) {
		// aclObject[curNode]['cmdList'] = [];
		let cmdList = [];
		Object.keys(geneInfo[curNode]).sort().forEach(function ( curIf ) {
			geneInfo[curNode][curIf].forEach(function ( curPolicy ) {
				ruleDevelop(curPolicy, ruleNumber, function ( cmd ) {
					// aclObject[curNode]['cmdList'] = aclObject[curNode]['cmdList'] || [];
					// aclObject[curNode]['cmdList'].push(cmd);
					cmdList.push(cmd);
				});
			});
		});
		aclObject[curNode] = new ACLObject(curNode, cmdList);
	});




	function ruleDevelop( policy, ruleNumber, callback ) {
		// console.log(policy);
		let ruleCounter = [];
		let actions = ['ACCEPT', 'DROP'];
		// let statelessFlag = [['SYN'], ['SYN','ACK'], ['ACK'], ['FIN'], ['ACK','FIN'], ['RST']];
		let statelessFlag = ['SYN', 'SYN,ACK', 'ACK', 'FIN', 'ACK,FIN', 'RST'];
		while ( ruleNumber > 0 ) {
			let count, maxValue,
				mode = randomValue(0, 2) % 2;
			switch ( mode ) {
				case 1:		// stateless mode
					maxValue = ( ruleNumber < 6 ) ? ruleNumber : 6;
					count = randomValue(1, maxValue);
					ruleCounter.push({mode: mode, count: count});
					ruleNumber -= count;
					break;

				// case 2:		// stateful mode
				// 	maxValue = ( ruleNumber < 2 ) ? ruleNumber : 2;
				// 	count = randomValue(1, maxValue);
				// 	ruleCounter.push({mode: mode, count: count});
				// 	ruleNumber -= count
				// 	break;

				default:	// any mode
					count = 1;
					ruleCounter.push({mode: mode, count: count});
					ruleNumber -= count
					break;
			}
		}

		ruleCounter.forEach(function ( curItem ) {
			let flagList = [];
			let cmd = `iptables`;
			let src_port, dest_port, tcp_flags;
			src_port = undefined;
			dest_port = undefined;
			tcp_flags = [];

			cmd += ` -A ${policy.in_out}`;
			if ( policy.in_out === 'INPUT' )
				cmd += ` -i`;
			else if ( policy.in_out === 'OUTPUT' )
				cmd += ` -o`;
			cmd += ` eth${policy.interface}`;
			cmd += ` -p tcp`;
			cmd += ` -s ${ipRandomization(policy.src_ip)}`;
			if ( src_port )
				cmd += ` --sport ${src_port}`;
			cmd += ` -d ${ipRandomization(policy.dest_ip)}`;
			if ( dest_port )
				cmd += ` --dport ${dest_port}`;

			for (let i=curItem.count; i>0; i--) {
				let  newCmd = deepcopy(cmd);
				if ( curItem.mode === 1 ) {
					tcp_flags = statelessFlag[randomValue(0, statelessFlag.length-1)];
					while ( checkElementIsExistInArray(tcp_flags, flagList) ) {
						tcp_flags = statelessFlag[randomValue(0, statelessFlag.length-1)];
					}
					flagList.push(tcp_flags);
					newCmd += ` --tcp-flags SYN,ACK,FIN,RST ${tcp_flags}`;
				}
				newCmd += ` -j ${actions[randomValue(0, 1)]}`;
				// console.log(newCmd);
				callback(newCmd);
			}

		});



		// cmd = `iptables -A OUTPUT -o eth2 -s 253.0.1.5/22 -d 140.134.30.0/24 --tcp-flags SYN,ACK,FIN,RST SYN,ACK -j DROP`;

		// ruleCounter.forEach(function ( curItem ) {
		// 	let flagList = [];
		// 	let rule = {};
		// 	rule['interface'] = `eth${policy.interface}`;
		// 	rule['in_out'] = policy.in_out;
		// 	rule['protocol'] = 'tcp';
		// 	rule['src_ip'] = ipRandomization(policy.src_ip);
		// 	rule['dest_ip'] = ipRandomization(policy.dest_ip);
		// 	// rule['src_port'] = undefined;
		// 	// rule['dest_port'] = undefined;


		// 	for (let i=curItem.count; i>0; i--) {
		// 		let newRule = deepcopy(rule);
		// 		let curFlag = [];
		// 		if ( curItem.mode === 1 ) {
		// 			curFlag = statelessFlag[randomValue(0, statelessFlag.length-1)];
		// 			while ( checkElementIsExistInArray(curFlag, flagList) ) {
		// 				curFlag = statelessFlag[randomValue(0, statelessFlag.length-1)];
		// 			}
		// 			flagList.push(curFlag);
		// 			newRule['tcp_flags'] = curFlag;
		// 		}
		// 		else {
		// 			newRule['tcp_flags'] = curFlag;
		// 		}
		// 		newRule['action'] = actions[randomValue(0, 1)];
		// 		callback(newRule);
		// 	}
		// });

		function ipRandomization ( ipData ) {
			let addr, min_ip, max_ip;
			let mask, maskValue, maxMask, maskSigma;
			let newAddr, newAddrValue, newMask, newMaskValue;
			[addr, mask] = ipData.split('/');
			maskValue = ( parseInt('1'.repeat(mask), 2) << 32-mask ) >>> 0;
			min_ip = ipConvertor(addr) & maskValue;
			max_ip = min_ip | ~(maskValue);
			newAddrValue = randomValue(min_ip, max_ip);

			newMask = randomValue(parseInt(mask), 24);
			// console.log(mask, newMask);
			newMaskValue = ( parseInt('1'.repeat(newMask), 2) << 32-newMask ) >>> 0;
			// console.log(mask, newMask, newMaskValue, ipConvertor(newMaskValue));
			newAddr = ipConvertor(newAddrValue & newMaskValue);
			

			return `${newAddr}/${newMask}`;
		}
	}

}