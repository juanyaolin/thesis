// "use strict";
const fs = require('fs');
const Getopt = require('node-getopt').create([
		['A', '=' 				, 'append rule to table option.'],
		['I', '=' 				, 'insert rule to table option.'],
		['i', '=' 				, 'interface to set inbound option.'],
		['o', '=' 				, 'interface to set outbound option.'],
		['p', '=' 				, 'protocol option.'],
		['s', '=' 				, 'source IP option.'],
		['', 'sport=ARG'		, 'source port option.'],
		['d', '=' 				, 'destination IP option.'],
		['', 'dport=ARG'		, 'destination port option.'],
		['', 'tcp-flags=ARG'	, 'TCP flag option.'],
		['j', '=' 				, 'action option.']
		]).bindHelp();



/*	[ACLFileObject Constructor]
 *	@ parameter
 *	filepath:	the file path of acl file to be convert
 *	
 *	@ output
 *	Return a object which contain below parameter,
 *	errList:	a list consist of error in the original file 
 *	lineList:	a list consist of 
 *	ruleList:	a list consist of rule which been convert
 *	ruleObject:	
 */
function ACLFileObject ( curObjName=null, filepath=null ) {
	let errList = [],
		ruleList = [],
		lineList = [],
		ruleObject = {};

	// do when a node is created to diagram.
	if ( filepath === null ) {
		// this.errList = errList;
		// this.lineList = lineList;
		// this.ruleList = ruleList;
		this.ruleObject = ruleObject;
		this.objName = curObjName;
		return this;
	}

	lineList = fs.readFileSync(filepath, 'utf-8').toString().split('\n');
	lineList.forEach(function ( line, lineCount ) {
		let rule = new RuleObject(line, lineCount, function ( err ) {
			if ( err ) { errList.push(err); } 
		});
		if ( isEmpty(rule) ) { return; }
		let interface = rule['interface'],
			in_out = rule['in_out'];
		
		ruleObject[interface] = ruleObject[interface] || {};
		ruleObject[interface][in_out] = ruleObject[interface][in_out] || [];
		rule['ruleorder'] = ruleObject[interface][in_out].length;
		rule['rulemode'] = 'normal';
		rule['firewall'] = curObjName;
		ruleObject[interface][in_out].push(rule);
		ruleList.push(rule);
	});

	this.errList = errList;
	// this.lineList = lineList;
	// this.ruleList = ruleList;
	this.ruleObject = ruleObject;
	this.objName = curObjName;
	return this;

	// to check is the object empty
	function isEmpty ( obj ) {
		// null and undefined are "empty"
		if (obj == null) return true;
		// Assume if it has a length property with a non-zero value
		// that that property is correct.
		if (obj.length > 0)    return false;
		if (obj.length === 0)  return true;
		// If it isn't an object at this point
		// it is empty, but it can't be anything *but* empty
		// Is it empty?  Depends on your application.
		if (typeof obj !== "object") return true;
		// Otherwise, does it have any properties of its own?
		// Note that this doesn't handle
		// toString and valueOf enumeration bugs in IE < 9
		for (var key in obj) {
			if (hasOwnProperty.call(obj, key)) return false;
		}
		return true;
	}

}







/*	[RuleObject Constructor]
 *	@ parameter
 *	line:		the main input data for this function, iptables commad line.
 *	lineCount:	counter of the input command line, need to pass by user.
 *	callback:	callback function, major to print error information.
 *	
 *	@ output
 *	Return a object which contain with,
 *	rulemode:	will be fill by calling function.
 *	ruleorder:	will be fill by calling function.
 *	lineorder:	the line order of original file, according to 'lineCount'.
 *	interface:	the interface of the rule be used, according to 'line'.
 *	in_out:		INPUT or OUTPUT chain is the rule be used, according to 'line'.
 *	protocol:	protocol of the rule, if tcp-flags is exist, this will be 'tcp'. According to 'line'.
 *	tcp_flags:	if exist, this will be a array with specify flags. Otherwise, it will be a empty array. According to 'line'.
 *	src_ip:		a AddressPrefixObject with source IP and mask information
 *	dest_ip:	a AddressPrefixObject with destination IP and mask information
 *	src_port:	source port information
 *	dest_port:	destination port information
 *	action:		the corresponding action of the rule, according to 'line'.
 */
function RuleObject ( line, lineCount, callback ) {
	let splitLine = line.trim().split(' ');
	let lineOption = Getopt.parse(splitLine);
	let tcp_flags = [], sip, dip, err;

	this.rulemode;
	this.ruleorder;
	this.lineorder = lineCount;

	// fill the 'interface' and 'in_out' to this object
	if ( lineOption['options']['A'] === 'INPUT' || lineOption['options']['I'] === 'INPUT' ) {
		if ( lineOption['options']['o'] ) {
			err = `[RuleObject] Append or insert to INPUT, but options of interface is '-o'.`;
			callback(err);
		}
		this.interface = lineOption['options']['i'];
		this.in_out = lineOption['options']['A'] ? lineOption['options']['A'] : lineOption['options']['I'];
	} else if ( lineOption['options']['A'] === 'OUTPUT' || lineOption['options']['I'] === 'OUTPUT' ) {
		if ( lineOption['options']['i'] ) {
			err = `[RuleObject] [line:${lineCount+1}] Append or insert to OUTPUT, but options of interface is '-i'.`;
			callback(err);
		}
		this.interface = lineOption['options']['o'];
		this.in_out = lineOption['options']['A'] ? lineOption['options']['A'] : lineOption['options']['I'];
	}
	
	// fill the 'protocol' and 'tcp_flags' to this object
	if ( lineOption['options']['tcp-flags'] ) {
		tcp_flags = lineOption['argv'][1].trim().split(',');
		this.protocol = 'tcp';
		this.tcp_flags = tcp_flags;
	} else if ( lineOption['options']['p'] ) {
		this.protocol = lineOption['options']['p'];
		this.tcp_flags = tcp_flags;
	} else {
		this.protocol = 'ip';
		this.tcp_flags = tcp_flags;
	}

	// fill the 'src_ip' to this object
	if ( lineOption['options']['s'] ) { sip = lineOption['options']['s']; }
	else { sip = '0.0.0.0/0'; }
	this.src_ip = new AddressPrefixObject(sip);

	// fill the 'dest_ip' to this object
	if ( lineOption['options']['d'] ) { dip = lineOption['options']['d']; }
	else { dip = '0.0.0.0/0'; }
	this.dest_ip = new AddressPrefixObject(dip);
	

	this.src_port = lineOption['options']['sport'];
	this.dest_port = lineOption['options']['dport'];
	
	// fill the 'protocol' and 'tcp_flags' to this object
	this.action = lineOption['options']['j'];

	if ( err ) {
		// console.log(`[${lineCount}] err`);
		for (let key in this) {
			delete this[key];
		}
	}
}

// some function is used in this javascript file.
{
	/*	[RuleObject Constructor]
	 *	@ parameter
	 *	ipdata:	ip information, express as a string like 'X.X.X.X/X'.
	 *	
	 *	@ output
	 *	Return a object which contain with,
	 *	maskData:		a value from 0 to 32, original value from calling function.
	 *	ipaddrData:		a ip address data, original string from calling function.
	 *	maskAddress:	a string to express network mask as 'X.X.X.X'
	 *	maskNumber:		a value in decimal to express network mask, according to 'maskAddress'.
	 *	ipMinAddress:	a string to express network address as 'X.X.X.X'
	 *	ipMinNumber:	a value in decimal to express network address, according to 'maskAddress'.
	 *	ipMaxAddress:	a string to express boardcast address as 'X.X.X.X'
	 *	ipMaxNumber:	a value in decimal to express boardcast address, according to 'maskAddress'.
	 */
	function AddressPrefixObject ( ipdata ) {
		let [ipaddr, mask] = ipdata.trim().split('/');
		
		this.maskData = mask;
		this.ipaddrData = ipaddr;
		this.maskNumber = ( parseInt('1'.repeat(mask), 2) << 32-mask ) >>> 0;
		this.maskAddress = ipConvertor(this.maskNumber);
		this.ipMinNumber = ((ipConvertor(ipaddr)) & (this.maskNumber)) >>> 0;
		this.ipMinAddress = ipConvertor(this.ipMinNumber);
		this.ipMaxNumber = ((this.ipMinNumber >>> 0) | (parseInt(('1'.repeat(32-mask)), 2))) >>> 0;
		this.ipMaxAddress = ipConvertor(this.ipMaxNumber);
	}

	/*	[ipConvertor]
	 *	If input data is a string to express IP address, it will return in value.
	 *	Otherwise, it will return a IP address as 'X.X.X.X'.
	 */
	function ipConvertor ( ipData ) {
		if ( !isNaN(ipData) ) {
			let Quotient = [],
				Remainder = [];

			Quotient[0] = ipData;
			for (var i = 0; i < 4; i++) {
				Remainder[i] = Math.floor( Quotient[i] % 256 );
				Quotient[i+1] = Math.floor( Quotient[i] / 256 );
			}

			let mask = Remainder[3];
			for (var i = 2; i >= 0; i--)
				mask = mask + '.' + Remainder[i];
			return mask;
		} else {
			let ipSplit = ipData.trim().split('.');
			return ( ( ((+ipSplit[0]) * 256) + (+ipSplit[1]) ) * 256 + (+ipSplit[2]) ) * 256 + (+ipSplit[3]);
		}
	}
}


module.exports = ACLFileObject;