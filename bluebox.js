var audioContext = new AudioContext();

const customKeyMap = {'Enter':'Dial'};

const schema = {1:[700,900],  2: [700, 1100], 3:[900,1100],4: [700, 1300], 5: [900, 1300], 6: [1100, 1300],
7: [700, 1500], 8: [900, 1500], 9: [1100, 1500], '*': [1100, 1700] ,0: [1300, 1500], '-': [1500, 1700], '+':[2600]};

const dtmf = {1:[697,1209],  2: [697, 1336], 3:[697,1477],4: [770, 1209], 5:
[770, 1336], 6: [770, 1477], 7: [852, 1209], 8: [852, 1336], 9: [852, 1477],
'*': [941, 1209] ,0: [941, 1336], '-': [941, 1477], 
'B1':{'frequencies':[2400,2600],'mark':150,'space':100},
'B2':{'frequencies':[2400],'mark':100,'space':100},
'+':{'sequence':['B1','B2']},'A':[697,1633], 'B':[770,1633],'C':[852,1633],'D':[941,1633]};

 
 const redbox = {"\'":{'frequencies':[1700,2200],'extra-text':'5c','mark':66,'space':66},
 				 "\`":{'frequencies':[1700,2200],'mark':33,'space':33},
 	1:{'sequence':"\'",'extra-text':'5c','space':1000},
 	2:{'sequence':"\'\'",'extra-text':'10c','space':1000},
 	3:{'sequence':"`````",'extra-text':'25c','space':1000},
 };

 const rotary = {'+':{'frequencies':[2600],'mark':75,'space':25},
 1:{'sequence':'+','space':1000},
 2:{'sequence':'++','extra-text':'ABC','space':1000},
 3:{'sequence':'+++','extra-text':'ABC','space':1000},
 4:{'sequence':'++++','extra-text':'ABC','space':1000},
 5:{'sequence':'+++++','extra-text':'ABC','space':1000},
 6:{'sequence':'++++++','extra-text':'ABC','space':1000},
 7:{'sequence':'+++++++','extra-text':'ABC','space':1000},
 8:{'sequence':'++++++++','extra-text':'ABC','space':1000},
 9:{'sequence':'+++++++++','extra-text':'ABC','space':1000},
 0:{'sequence':'++++++++++','extra-text':'ABC','space':1000},
 11:{'sequence':'+++++++++++','extra-text':'ABC','space':1000},
}


const schema2 = {1: {'frequencies': [700,900],
},
				2: {'frequencies': [700, 1100],
				'extra-text':'ABC',
			},
				3: {'frequencies': [900,1100],
				'extra-text':'DEF',
			},
				4: {'frequencies': [700, 1300],
				'extra-text':'GHI',
			},
				5: {'frequencies': [900, 1300],
				'extra-text':'JKL',
			},
				6: {'frequencies': [1100, 1300],
				'extra-text':'MNO',
			},
				7: {'frequencies': [700, 1500],
				'extra-text':'PRS',
			},
				8: {'frequencies': [900, 1500],
				'extra-text':'TUV',
			},
				9: {'frequencies': [1100, 1500],
				'extra-text':'WXY',
			},
				'*': {'frequencies':[1100, 1700],
				'extra-text':'KP', 'mark': 110,
			},
				0: {'frequencies':[1300, 1500],
				'extra-text':'OPERATOR',
			},
				'-': {'frequencies':[1500, 1700],
				'extra-text':'ST', 
			},
				'/': {'frequencies':[1300, 1700],
				'extra-text':'KP2', 'mark': 110,
			},
				'+': {'frequencies':[2600],
				'extra-text':'','mark':250,'space':1000}
			};

//const schemas = {'sf','mf','dtmf','redbox'}

var currentKeys = new Set();


function Decoder(audioContext){
	this.context = audioContext;
	this.tolerance = 10.0;
	this.analyser = this.context.createAnalyser();

	this.filter = this.context.createBiquadFilter();
    this.filter.channelCount = 1;
    this.filter.type = "lowpass";
    this.filter.frequency = 3000;
    this.filter.connect(this.analyser);

	this.sampleRate = this.context.sampleRate;
	this.analyser.fftSize = 4096;
	this.bufferLength = this.analyser.frequencyBinCount;
	this.dataArray = new Uint8Array(this.bufferLength);
	this.previousArray = new Uint8Array(this.bufferLength);
	this.averagedArray = new Uint8Array(this.bufferLength);
	this.analyser.minDecibels = -70;
	this.analyser.maxDecibels = -10;
	this.analyser.smoothingTimeConstant = 0;
	//this.analyser.connect(this.context.destination)
}

Decoder.prototype.setup = function(schema){
	this.schema = schema;
	this.reverseSchema = {};//set of frequencies corresponding to signals

	for (key in this.schema){
		for (f in this.schema[key]){
			var frequency = this.schema[key][f];
			if(!this.reverseSchema[frequency]){
				this.reverseSchema[frequency] = new Set();
			} 
			this.reverseSchema[frequency].add(key);
		}
	}
}

Decoder.prototype.getMax = function(array){
	return array.reduce((iMax, x, i, arr) => x > array[iMax] ? i : iMax, 0);
}

Decoder.prototype.decode = function(){
	var peaks = this.getPeaks();

	var freqs = new Set();
	var candidateDigits = new Set();

	// compare which frequencies are present
	/*- cycle through frequencies in reverseSchema
	  - if a frequency is in the range of a peak, add its digits to a list of candidate digits
	  - 
	*/

	for (i in peaks){
		var peak = peaks[i];

		for (var freq in this.reverseSchema){
			if( (freq-this.tolerance) <= peak && (freq-+-this.tolerance) > peak){
				freqs.add(freq);

				for (candidate of this.reverseSchema[freq]){
					if (!candidateDigits[candidate]){
						candidateDigits[candidate] = 0;
					} candidateDigits[candidate] += 1;
				}
			}
		}
	}

	var final = new Array();
	//console.log(peaks);

	for (digit in candidateDigits){
		if (candidateDigits[digit] === this.schema[digit].length){
			//console.log(peaks)
			final.push(digit);
		}
	}

	//console.log(peaks);

	return final;
}

Decoder.prototype.getPeaks = function(){
	var peaks = new Array();

	this.analyser.getByteFrequencyData(this.dataArray);

	var binFreq = this.sampleRate / this.analyser.fftSize;

	var indexOfMax = this.getMax(this.dataArray);
	var halfmax = (7.0*this.dataArray[indexOfMax]? this.dataArray[indexOfMax] / 8 : 0);

	var j = 0;
	for (var i=0; i<this.dataArray.length-1; i++){
		if (this.dataArray[i] > halfmax){
			j = (this.dataArray[j] < this.dataArray[i]) ? i : j;
			if (this.dataArray[i+1] < halfmax){
				peaks.push(j*binFreq);
				j = 0;
			}
		}
	}
	return peaks;
}

var decoder = new Decoder(audioContext);
decoder.setup(schema);


function Tone(audioContext,frequency){
	var oscillator = audioContext.createOscillator();
	oscillator.type = 'sine';
	oscillator.frequency.setValueAtTime(frequency,audioContext.currentTime); // value in hertz
	// set to mono for performance reasons
	oscillator.channelCount = 1;

	return oscillator;
}


//keep a set of tones to be turned on or off
function ToneMixer(audioContext){
	this.context = audioContext;
	this.nodes = {};
	this.defaultGain = 0.07;
	this.whichOn = new Set();
} 

ToneMixer.prototype.setup = function(frequencies){

    // create a master volume control for use e.g. with a slider
    this.nodes.masterGain = {};
    masterGain = this.context.createGain();
    masterGain.channelCount = 1;
    masterGain.gain.value = 10;
    masterGain.connect(this.context.destination);
    this.nodes.masterGain.node = masterGain;

    // create a lowpass filter, just like in POTS
    this.nodes.filter = {};
    filter = this.context.createBiquadFilter()
    filter.channelCount = 1;
    filter.type = "lowpass";
    filter.frequency = 8000;
    filter.connect(this.nodes.masterGain.node);
    this.nodes.filter.node = filter;

    // initialize frequency oscillators and their gain nodes
	for (var i in frequencies){
		var frequency = frequencies[i];
		this.addTone(frequency);
	}
}

ToneMixer.prototype.addTone = function(frequency){

	if (!this.nodes[frequency]){
		this.nodes[frequency] = {};
	}
	var tone = new Tone(this.context,frequency);
	this.nodes[frequency].node = tone;

	if (!this.nodes[frequency].gainNode){
	gainNode = this.context.createGain();
	gainNode.channelCount = 1;
	gainNode.gain.value = this.defaultGain;
	gainNode.connect(this.nodes.filter.node);

	this.nodes[frequency].gainNode = gainNode;
}
	tone.connect(this.nodes[frequency].gainNode);
}

ToneMixer.prototype.setGain = function(frequency,gain=this.defaultGain){
	if (this.nodes[frequency].gainNode){
		this.nodes[frequency].gainNode.gain.value = gain;
	}
}

ToneMixer.prototype.start = function(frequency, time = 0){
	if (!this.whichOn.has(frequency)){
		this.nodes[frequency].node.start(time);
		this.whichOn.add(frequency);
	}
}

ToneMixer.prototype.stop = function(frequency, time = 0){
	if (this.whichOn.has(frequency)){
		this.nodes[frequency].node.stop(time);
		this.whichOn.delete(frequency);

		//once tone is stopped, re-initialize for next usage
		this.addTone(frequency);
	}
}

// handle case where out of focus
ToneMixer.prototype.mute = function(){
	this.nodes.masterGain.previous = this.nodes.masterGain.node.gain.value;
	this.nodes.masterGain.node.gain.value = 0;
}

ToneMixer.prototype.unmute = function(){
	if (!this.nodes.masterGain.node.gain.value){
	this.nodes.masterGain.node.gain.value = this.nodes.masterGain.previous;
	}
}

ToneMixer.prototype.isPlaying = function(){
	return Boolean(this.whichOn.size);
}


// MF tone dialer
function ToneDialer(toneMixer, schema, mark = 65, space = 65){
	this.toneMixer = toneMixer;

	this.schema = schema;
	this.keysPressed = new Set();

	this.mark = mark;
	this.space = space;

	this.dialing = false;
}

ToneDialer.prototype.setup = function(){
	var frequencies = new Set();
	for (key in this.schema){
		frequencies = new Set([...frequencies,...this.schema[key]['frequencies']?
		 this.schema[key]['frequencies'] : this.schema[key]['sequence']?
		  new Set(): this.schema[key]]);
	}
	console.log(frequencies);
	this.toneMixer.setup([...frequencies]);

	//make trunk seizure tones louder
	this.toneMixer.addTone(2600);
	this.toneMixer.addTone(2400);
	this.toneMixer.setGain(2600,1);
	this.toneMixer.setGain(2400,1); 
}


//buggy
/*
ToneDialer.prototype.update2 = function (key, time = 0){
	if (!this.keysPressed.has(key)){
		for(f in this.schema[key]){
			var frequency = this.schema[key][f];
			if (!this.toneMixer.whichOn.has(frequency)){
				this.toneMixer.start(frequency,time);
			}		
		}		
		
		this.keysPressed.add(key);

	}
}
*/

ToneDialer.prototype.update = function (keys = new Set(),time=0){
	var frequencies = new Set();

	for (var key of keys){
		var ref = this.schema[key]? this.schema[key]['frequencies'] || this.schema[key] : new Set();
		frequencies = new Set([...frequencies,...ref]);
	}

	var union = new Set([...frequencies,...this.toneMixer.whichOn]);
	for (var frequency of union){

		if (this.toneMixer.whichOn.has(frequency) && !frequencies.has(frequency)){
			this.toneMixer.stop(frequency,time);
		} else
		if (frequencies.has(frequency)){
			this.toneMixer.start(frequency,time);
		}
	}
	//console.log(this.toneMixer.whichOn);
}

/*
ToneDialer.prototype.stopMF = function (key,time=0){
	if (this.keysPressed.has(key)){
		this.keysPressed.delete(key);

		for (f in this.schema[key]){
			var stop = true;
			var frequency = this.schema[key][f];

			var otherKeys = this.freqMap[frequency];
			for (var otherKey in otherKeys){
				if (this.keysPressed.has(otherKey)){
					stop = false;
				}
			}		
			if (stop) this.toneMixer.stop(frequency,time);
		}

	}
	console.log(this.toneMixer.whichOn);
}
*/

ToneDialer.prototype.dial = function(sequence, time){

	var time = time || this.toneMixer.context.currentTime;

	for(i in sequence){
		digit = sequence[i];
		if (this.schema[digit]){
			var space = (this.schema[digit]['space'] || this.space)/1000;
			if (this.schema[digit]['sequence']){
				time = this.dial(this.schema[digit]['sequence'],time);
				console.log('R',digit,space);
			} else {
				this.update(new Set([digit]),time);
				time += (this.schema[digit]['mark']  || this.mark )/1000;
				this.update(new Set(),time);			
				console.log(digit,this.schema[digit]['space']);
			}				
			time += space;
		}
	}	
	return time;
}

ToneDialer.prototype.play = function(keys,time){
	for (key of keys){
		if (this.schema[key]){
			if (this.schema[key]['sequence']){
				this.dial(key);
				return;
			}
		}
	}
	this.update(keys,time);
}

ToneDialer.prototype.stop = function(keys,time){
	for (key of keys){
		if (this.schema[key]){
			if (this.schema[key]['sequence']){
				keys.delete(key);
			}
		}
	}
	this.update(keys,time);
}


// event handlers
// style-related event handlers
function styleKeyDown(e){
	var char = customKeyMap[e.key] || e.key.toUpperCase() || e.toUpperCase();
	$('.key').filter(function(){return ($(this).html() || $(this).val())===char}).addClass('active');
}

function styleKeyUp(e){
	var char = customKeyMap[e.key] || e.key.toUpperCase() || e.toUpperCase();
	$('.key').filter(function(){return ($(this).html() || $(this).val())===char}).removeClass('active');
}

function styleTouchStart(e){
	oldThis = this;
	$(this).addClass('touch-active');
	// prevent an additional mousedown event from firing on a touchstart
	if (e.type=='touchstart'){
		$(this).off('mousedown')
	}
	// if the user lets go of the key after the mouse or touch gesture has moved
	$(document).on('touchend mouseup', function(e){
		$(oldThis).removeClass('touch-active');
		$(this).off(e)
	});
}



//disable keys that are not in the toneDialer's schema, except for a few keys 
function disableKeys(dialType){
	$('.key').addClass('disabled');
	$('#dial').removeClass('disabled');
	$('#dialType').removeClass('disabled');
	$('#mode').removeClass('disabled');

	for (key in dialers[dialType].schema){
		$('.key').filter(function(){return $(this).html()===key}).removeClass('disabled');
	}
}

// audio-related event handlers
function playTone(e){
	var char = e.key || e;
	char = char.toUpperCase();

	if (currentKeys.has(char)){
		return;
	} else { 
		currentKeys.add(char);
		toneBox.play(currentKeys,audioContext.currentTime);
	}
	//console.log(currentKeys);
}

function touchTone(e){
		if (e.type==='touchstart'){
			$(this).off('mousedown');
		}
		var key = $(this).html();
		playTone(key);

		$(document).on('touchend mouseup', function(e){
			stopTone(key);
			$(this).off(e);
		});	

	}

function stopTone(e){
	var char = e.key || e;
	char = char.toUpperCase();
	currentKeys.delete(char);
	toneBox.stop(currentKeys,audioContext.currentTime);
}


function clearallKeyEvents(){
	$(document).off('keydown keyup mousedown mouseup touchstart touchend');
	$('.key').off('mousedown touchstart mouseup touchend');
}

function clearAudioEvents(){
	$('.key').off('mousedown touchstart', touchTone);
	$('.key').off('mouseup touchend', stopTone);

	$(document).off('keydown', playTone);
	$(document).off('keyup', stopTone)

	$('#dial').off('click',dial);
}

function bindStyleKeyEvents(){
	$(document).on('keydown',styleKeyDown);
	$(document).on('keyup',styleKeyUp);

	$('.key').on('touchstart mousedown', styleTouchStart)
}

function bindToneKeyEvents(){
	$(document).on('keydown', playTone);
	$(document).on('keyup',stopTone);

	$('.key').on('touchstart mousedown', touchTone);

	$('#dial').on('click',dial);
}

function dial(){
		if ($('#mode').html()=='Decode'){
			$('#mode').click();
		}

		var number = $('#number').val();
		number = number.toUpperCase();
		dialers[dialType].dial(number);
	}

var toneMixer = new ToneMixer(audioContext);
var toneDialer = new ToneDialer(toneMixer,schema2);
toneDialer.setup();
var dtmfDialer = new ToneDialer(toneMixer,dtmf);
dtmfDialer.setup();
var sfDialer = new ToneDialer(toneMixer,rotary);
sfDialer.setup();

var redBox = new ToneDialer(toneMixer,redbox);
redBox.setup();

var toneBox = null;
var dialers = {'Rotary':sfDialer, 'DTMF':dtmfDialer,'MF':toneDialer,'Red':redBox};
var dialType = null;
var lastCalled = null;

// dial a number when the dial button is clicked
$(function(){
	alert('Welcome to BetterBlueBox! \
		Touch or type numbers to hear them play. \
		You can also decode tones in realtime by toggling \
		the "Play/Decode" button in SS5 or DTMF modes. \
		Toggle between bluebox, whitebox and redbox modes by pressing the "DTMF" button! \
		Send feedback to https://github.com/FilipMiscevic/BetterBlueBox/issues')
	//style keys
	bindStyleKeyEvents();

	// initialize default schema
	dialType = $('#dialType').html();
	toneBox = dialers[dialType]
	lastCalled = bindToneKeyEvents;
	lastCalled();
	disableKeys(dialType);
	decoder.setup(dtmf);


	//var dialIdx = -1; $('#dialType').click();
	$('#dialType').click(function(){
			clearAudioEvents();

			//dialIdx += 1;

			var key = $(this).html()

			if (key==='Red'){
				dialType = 'DTMF';
				$(this).html(dialType);
				$('.key, .bubble').removeClass('red-box');
				$('.key, .bubble').addClass('white-box');

				decoder.setup(dtmf);
			} else if (key==='DTMF'){
				dialType = 'MF';
				$(this).html(dialType);
				$('.key, .bubble').removeClass('white-box');
				$('.key, .bubble').addClass('blue-box');
				decoder.setup(schema);
			} else if (key==='MF'){
				dialType = 'Rotary';
				$(this).html('SF');
			} else if (key==='SF'){
				dialType = 'Red';
				$('.key, .bubble').removeClass('blue-box');
				$('.key, .bubble').addClass('red-box');
				$(this).html(dialType);
			}

			toneBox = dialers[dialType];
			disableKeys(dialType);
			bindToneKeyEvents();
	});

	$('#dial').click(dial);

	$('#number').focus(function(){
		clearAudioEvents();
		//$(this).removeAttr('readonly').select();
		//$(this).value(function(){return this.value + $('.key').on('')});
	});

	$('#number').blur(function(){
		lastCalled();
		//$(this).attr('readonly', 'readonly');
	});

	$(document).on('keyup', function(e){
		var char = e.key;
		if (char == ' '){
			$('#dialType').click();
		} else if (char == 'Enter'){
			$('#dial').click();
		}
	});

	var i = null;
	var decoded = null;

	$('#mode').click(function(){
		var mode = $(this).html();

		if (mode === 'Play'){
			$(this).html('Decode');
			$(this).addClass('record');


			var handleSuccess = function(stream) {
				var source = audioContext.createMediaStreamSource(stream);

				source.connect(decoder.filter);

				i = setInterval(function(){
					var oldDecoded = decoded;
					decoded = decoder.decode()[0];
					if ( (oldDecoded !== decoded) && (decoded !== undefined)){
						console.log(decoded);
						$('#number').val($('#number').val()+decoded);
					}
				},10);

			};

			navigator.mediaDevices.getUserMedia({ audio: true, video: false })
			.then(handleSuccess);

		} else if (mode === 'Decode'){
			clearInterval(i);
			$(this).html('Play')
			$(this).removeClass('record');
		}
	})

});