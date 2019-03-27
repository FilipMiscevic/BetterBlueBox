var pressed = []
var audioContext = new AudioContext();

const schema = {1:[700,900],  2: [700, 1100], 3:[900,1100],4: [700, 1300], 5: [900, 1300], 6: [1100, 1300],
7: [700, 1500], 8: [900, 1500], 9: [1100, 1500], '*': [1100, 1700] ,0: [1300, 1500], '-': [1500, 1700], '+':[2600]}

const dtmf = {1:[697,1209],  2: [697, 1336], 3:[697,1477],4: [770, 1209], 5:
[770, 1336], 6: [770, 1477], 7: [852, 1209], 8: [852, 1336], 9: [852, 1477],
'*': [941, 1209] ,0: [941, 1336], '-': [941, 1477], '+':[350,440]}

var currentKeys = new Set();


function Tone(context,frequency){
	var oscillator = context.createOscillator();
	oscillator.type = 'sine';
	oscillator.frequency.setValueAtTime(frequency,context.currentTime); // value in hertz

	return oscillator
}


//keep a set of tones to be turned on or off
function ToneMixer(audioContext){
	this.context = audioContext;
	this.tones = {};
	this.gains = {};
	this.whichOn = new Set();
} 

ToneMixer.prototype.setup = function(frequencies){

    this.filter = this.context.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency = 8000;
    this.filter.connect(this.context.destination);

	for (var i in frequencies){
		var frequency = frequencies[i];
		this.addTone(frequency);
	}
}

ToneMixer.prototype.addTone = function(frequency,gain=0.07){
	var tone = new Tone(this.context,frequency);

	if (!this.gains[frequency]){
	gainNode = this.context.createGain();
	gainNode.gain.value = gain;
	gainNode.connect(this.filter)

	//add to dict of tones	
	this.gains[frequency] = gainNode;
}	
	tone.connect(this.gains[frequency]);
	this.tones[frequency] = tone;
}

ToneMixer.prototype.start = function(frequency, time = 0){
	if (!this.whichOn.has(frequency)){
		this.tones[frequency].start(time);
		this.whichOn.add(frequency);
	}
}

ToneMixer.prototype.stop = function(frequency, time = 0){
	if (this.whichOn.has(frequency)){
		this.tones[frequency].stop(time);
		this.whichOn.delete(frequency);

		//once tone is disconnected, re-initialize for next usage
		this.addTone(frequency);
	}
}

// handle case where out of focus
ToneMixer.prototype.mute = function(){
	this.filter.disconnect(this.context.destination);
}

ToneMixer.prototype.disconnectAll = function(){
	for (var frequency of this.whichOn){
		this.tones[frequency].disconnect();
		this.whichOn.delete(frequency);
	}
}

ToneMixer.prototype.unmute = function(){
	this.filter.connect(this.context.destination);
}


//implement actual box
function ToneBox(toneMixer,schema){
	this.toneMixer = toneMixer;
	this.schema = schema;
	this.keysPressed = new Set();
	this.toneMixer.setup(Object.values(this.schema).flat());
	this.toneMixer.gains[2600].gain.value = 1;

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
ToneBox.prototype.playMF2 = function (key, time = 0){
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

ToneBox.prototype.playMF = function (keys = new Set(),time=0){
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
ToneBox.prototype.stopMF = function (key,time=0){
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

function ToneDialer(toneBox,duration=75,gap=75){
	this.toneBox = toneBox;
	this.duration = duration/1000;
	this.gap = gap/1000;
}


ToneDialer.prototype.dial = function(sequence){

	//TODO: stop existing tones from playing
	this.toneBox.toneMixer.disconnectAll();

	var time = this.toneBox.toneMixer.context.currentTime;

	for(i in sequence){
		mf = sequence[i];
		this.toneBox.playMF(new Set([mf]),time);
		time += this.duration;
		this.toneBox.playMF(new Set(),time);
		time += this.gap;
	}

}


function PulseDialer(toneMixer){
	this.toneMixer = toneMixer;
	this.freq = 2600;

	this.pulsePerSecond = 10;
	this.pulseProportion = 0.7;
	this.interPulsePause = 1;

	this.digitPulses = {0:10,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10};
}

PulseDialer.prototype.dial = function(sequence){

	var time = this.toneMixer.context.currentTime

	for (var j in sequence){
		var digit = sequence[j];
		time = this.pulseDigit(digit,time);
		time += this.interPulsePause;
	}

}

PulseDialer.prototype.pulseDigit = function(digit,time=this.toneMixer.context.currentTime){

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

// event handlers

$(document).keydown(function(e){
	var char = e.key;

	if (currentKeys.has(char)){
		return;
	} else { 
		currentKeys.add(char);

		toneBox.playMF(currentKeys);
	}
	console.log(currentKeys);
});


$(document).keyup(function(e){
	var char = e.key;

	currentKeys.delete(char);

	console.log(char);
	toneBox.playMF(currentKeys);
	//pulseDialer.pulseDigit(char);


});

var toneMixer = new ToneMixer(audioContext);
var toneBox = new ToneBox(toneMixer,schema);
var pulseDialer = new PulseDialer(toneMixer);