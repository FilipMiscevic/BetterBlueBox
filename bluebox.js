var audioContext = new AudioContext();

const schema = {1:[700,900],  2: [700, 1100], 3:[900,1100],4: [700, 1300], 5: [900, 1300], 6: [1100, 1300],
7: [700, 1500], 8: [900, 1500], 9: [1100, 1500], '*': [1100, 1700] ,0: [1300, 1500], '-': [1500, 1700], '+':[2600]};

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
				'extra-text':'KP',
			},
				0: {'frequencies':[1300, 1500],
				'extra-text':'OPERATOR',
			},
				'-': {'frequencies':[1500, 1700],
				'extra-text':'ST',
			},
				'+': {'frequencies':[2600],
				'extra-text':''}
			};


const dtmf = {1:[697,1209],  2: [697, 1336], 3:[697,1477],4: [770, 1209], 5:
[770, 1336], 6: [770, 1477], 7: [852, 1209], 8: [852, 1336], 9: [852, 1477],
'*': [941, 1209] ,0: [941, 1336], '-': [941, 1477], '+':[350,440]};

var currentKeys = new Set();


function Decoder(audioContext,reverseSchema){
	this.context = audioContext;
	this.schema = reverseSchema; //set of frequencies corresponding to signals
	
	this.lastDecoded = null;
}

Decoder.prototype.setup = function(){
	this.analyser = this.context.createAnalyser();

	this.sampleRate = this.context.sampleRate;
	this.analyser.fftSize = 4096;
	this.bufferLength = this.analyser.frequencyBinCount;
	this.dataArray = new Uint8Array(this.bufferLength);
	this.analyser.minDecibels = -90;
	this.analyser.maxDecibels = -10;
	this.analyser.smoothingTimeConstant = 0.4;
	this.analyser.connect(this.context.destination)

}

Decoder.prototype.getMax = function(array){
	return array.reduce((iMax, x, i, arr) => x > array[iMax] ? i : iMax, 0);
}


Decoder.prototype.getPeaks = function(){}

Decoder.prototype.decode = function(){

	this.analyser.getByteFrequencyData(this.dataArray);

	var binFreq = this.sampleRate / this.analyser.fftSize;

	var indexOfMax = this.getMax(this.dataArray);
	var halfmax = this.dataArray[indexOfMax]? this.dataArray[indexOfMax] / 2 : 0;

	var j = 0;
	for (var i=0; i<this.dataArray.length-1; i++){
		if (this.dataArray[i] > halfmax){
			j = (this.dataArray[j] < this.dataArray[i]) ? i : j;
			if (this.dataArray[i+1] < halfmax){
				console.log(j*binFreq);
				j = 0;
			}
		}
	}
}

var decoder = new Decoder(audioContext,schema);
decoder.setup();


function Tone(audioContext,frequency){
	var oscillator = audioContext.createOscillator();
	oscillator.type = 'sine';
	oscillator.frequency.setValueAtTime(frequency,audioContext.currentTime); // value in hertz

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
    masterGain.gain.value = 1;
    masterGain.connect(decoder.analyser);
    this.nodes.masterGain.node = masterGain;

    // create a lowpass filter, just like in POTS
    this.nodes.filter = {};
    filter = this.context.createBiquadFilter()
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
function ToneDialer(toneMixer, schema, duration = 120, gap = 75){
	this.toneMixer = toneMixer;
	this.schema = schema;
	this.keysPressed = new Set();
	this.toneMixer.setup(Object.values(this.schema).flat());
	this.toneMixer.setGain(2600,1); //make 2600Hz louder

	this.duration = duration/1000;
	this.gap = gap/1000;

	this.dialing = false;
	/*
	this.freqMap = {};
	for (key in schema){
		for (f in schema[key]){
			var frequency = schema[key][f];
			if(this.freqMap[frequency]){
				this.freqMap[frequency].add(key);
			} else this.freqMap[frequency] = new Set();
		}
	}
	*/
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
		for(frequency in this.schema[key]){
			frequencies.add(this.schema[key][frequency]);
		}
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
	console.log(this.toneMixer.whichOn);
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

ToneDialer.prototype.dial = function(sequence){

	//TODO: stop existing tones from playing
	//this.ToneDialer.toneMixer.disconnectAll();

	var time = this.toneMixer.context.currentTime;

	for(i in sequence){
		mf = sequence[i];
		this.update(new Set([mf]),time);
		time += this.duration;
		this.update(new Set(),time);
		time += this.gap;
	}

}


function PulseDialer(toneMixer){
	this.toneMixer = toneMixer;
	this.freq = 2600;

	this.pulsePerSecond = 10;
	this.pulseProportion = 0.75;
	this.interPulsePause = 1;

	this.digitPulses = {0:10,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10};

	this.dialing = false;
}

PulseDialer.prototype.setup = function(){
	if (!this.toneMixer.frequencies[this.freq]){
		this.toneMixer.setup([this.freq]);
	}
	this.toneMixer.setGain(this.freq,1);
}

PulseDialer.prototype.dial = function(sequence){

	var time = this.toneMixer.context.currentTime;

	for (var j in sequence){
		var digit = sequence[j];
		time = this.pulseDigit(digit,time);
		time += this.interPulsePause;
	}
}

PulseDialer.prototype.pulseDigit = function(digit,time=0){

	var pulseDuration = this.pulseProportion / this.pulsePerSecond;
	var pauseDuration = (1.0-this.pulseProportion) / this.pulsePerSecond;

	var digitPulses = this.digitPulses[digit] || 0;

	for (var i = 0; i < digitPulses; i++){

		this.toneMixer.start(this.freq,time);
		time += pulseDuration;
		this.toneMixer.stop(this.freq,time);
		time += pauseDuration;

	}	
	return time;
}

/*
function ToneBox(dialers,defaultDialType){
	this.dialers = dialers;
	this.dialer = this.dialers[defaultDialType];
	this.dialType = defaultDialType;
};

ToneBox.prototype.setDialer = function(dialType){
	if (this.dialers[dialType]){
		this.dialer = this.dialers[dialType];
		this.dialType = dialType;
	}
};

ToneBox.prototype.getDialer = function(dialType=this.dialType){
	return this.dialers[dialType];
};
*/


// event handlers
function update(char){

	if (currentKeys.has(char)){
		return;
	} else { 
		currentKeys.add(char);
		toneBox.update(currentKeys,audioContext.currentTime);
	}
	console.log(currentKeys);
}

function stopMF(char){
	currentKeys.delete(char);
	toneBox.update(currentKeys,audioContext.currentTime);
}

function pulseDigit(digit){

	if (!pulseDialer.dialing){	
		pulseDialer.dialing = true;
		pulseDialer.pulseDigit(digit);
	}
	pulseDialer.dialing = false;
};

function clearKeyEvents(){
	$(document).off('keydown keyup mousedown mouseup touchstart touchend');
	$('.key').off('mousedown touchstart')
}

function bindRotaryKeyEvents(){

	$(document).on('keyup',function(e){
		pulseDialer.pulseDigit(e.key,audioContext.currentTime);
	});

	$('.key').on('mousedown',function(e){
		var char = $(this).html();
		console.log('Are we firing twice?')
		$(document).on('mouseup touchend',function(){
			pulseDialer.pulseDigit(char,audioContext.currentTime);
			$(document).off('mouseup touchend');
		});	

	});
}

function bindToneKeyEvents(){

	$(document).on('keydown', function(e){
		update(e.key);
		var thisKey = $('.key').filter(function(){return $(this).html()===e.key}).addClass('active');
	});

	$(document).on('keyup',function(e){
		stopMF(e.key);
		$('.key').filter(function(){return $(this).html() === e.key}).removeClass('active');
	});


	$('.key').on('mousedown touchstart',function(e){
		e.stopImmediatePropagation();
		var key = $(this).html();
		update(key);
		$(document).on('mouseup touchend',function(){
			stopMF(key);
			$(document).off('mouseup touchend');
		});	

	});

}



var toneMixer = new ToneMixer(audioContext);
var toneDialer = new ToneDialer(toneMixer,schema);
var dtmfDialer = new ToneDialer(toneMixer,dtmf);
var pulseDialer = new PulseDialer(toneMixer);
var toneBox = null;
var dialers = {'Rotary':pulseDialer, 'DTMF':dtmfDialer,'MF':toneDialer};
var dialType = null;

// mute keys when typing a number
$(function(){
	$('#number').focus(function(){
		$(document).off('keydown');
		$(document).off('keyup');
	});
	$('#number').blur();
});


// dial a number when the dial button is clicked
$(function(){

	dialType = $('#dialType').val() || 'MF';


	toneBox = dialers['MF']

	bindToneKeyEvents();

	$('#dialType').click(function(){
			clearKeyEvents();

			var key = $(this).html()

			if (key==='Pulse'){
				dialType = 'DTMF';
				$(this).html(dialType);
				toneBox = dialers[dialType];
				bindToneKeyEvents();
			} else if (key==='DTMF'){
				dialType = 'MF';
				$(this).html(dialType);
				toneBox = dialers[dialType];
				bindToneKeyEvents();
			} else if (key==='MF'){
				dialType = 'Rotary';
				$(this).html('Pulse');
				bindRotaryKeyEvents();
			}
	});

	$('#dial').click(function(){
		var number = $('#number').val();
		dialers[dialType].dial(number);
	});


});


