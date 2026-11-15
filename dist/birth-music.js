const chords = [[48, 55, 62, 64], [45, 52, 59, 60], [41, 48, 55, 57], [43, 50, 57, 62]];
const underworldChords = [[33, 45, 51, 56], [32, 44, 50, 55], [30, 42, 49, 54], [32, 44, 47, 53]];
const journeyChords = [[38, 57, 64, 65], [34, 53, 60, 62], [41, 57, 60, 67], [36, 55, 62, 64]];
const frequency = note => 440 * 2 ** ((note - 69) / 12);

const cues = {
  navigate: {notes:[76], length:.2, level:.11, gap:0},
  hangar: {notes:[57, 64, 69], length:.7, level:.14, gap:.1},
  star: {notes:[60, 67, 72], length:1.5, level:.2, gap:.11},
  save: {notes:[67, 72], length:.65, level:.15, gap:.09},
  prize: {notes:[60, 67, 72, 76], length:1.5, level:.2, gap:.12}
};

export function createBirthMusic() {
  const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Audio) return null;

  let context, volume, musicBus, interval, nextChord;
  let chordIndex = 0, playing = false, disposed = false, scene = 'space';

  function tone(note, start, duration, level, type = 'sine', output = volume) {
    const voice = context.createOscillator();
    const envelope = context.createGain();
    voice.frequency.value = frequency(note);
    voice.type = type;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(level, start + duration * .22);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    voice.connect(envelope).connect(output);
    voice.start(start);
    voice.stop(start + duration);
    voice.onended = () => {voice.disconnect(); envelope.disconnect();};
  }

  function musicTone(note, offset, duration, level, type) {
    tone(note, nextChord + offset, duration, level, type, musicBus);
  }

  function schedule() {
    const now = context.currentTime;
    nextChord = Math.max(now + .05, nextChord);
    if (nextChord > now + .35) return;
    if (scene === 'underworld') {
      underworldChords[chordIndex].forEach((note, index) => {
        musicTone(note, index * .18, 2.6, index === 0 ? .29 : .09, 'triangle');
      });
      musicTone(underworldChords[chordIndex][0] - 5, 1.35, .62, .23);
      chordIndex = (chordIndex + 1) % underworldChords.length;
      nextChord += 2.8;
      return;
    }
    if (scene === 'bridge' || scene === 'hangar') {
      const [bass, lowPad, highPad, melody] = journeyChords[chordIndex];
      if (scene === 'bridge') {
        musicTone(bass, 0, 4.1, .24);
        musicTone(lowPad, .45, 3.6, .11);
        musicTone(highPad, .85, 3.15, .09);
        musicTone(melody + 12, 1.7, 1.25, .12, 'triangle');
        musicTone(highPad + 12, 2.65, 1.05, .1);
        nextChord += 3.8;
      } else {
        [bass, bass + 12, bass, bass + 12].forEach((note, index) => {
          musicTone(note, index * .62, .49, index % 2 ? .13 : .24, 'triangle');
        });
        [lowPad, highPad, melody, highPad + 12].forEach((note, index) => {
          musicTone(note, .31 + index * .62, .72, .12);
        });
        nextChord += 2.48;
      }
      chordIndex = (chordIndex + 1) % journeyChords.length;
      return;
    }
    chords[chordIndex].forEach((note, index) => {
      musicTone(note, index * .28, 6.7, index === 0 ? .22 : .12);
    });
    chordIndex = (chordIndex + 1) % chords.length;
    nextChord += 5.6;
  }

  function startScene() {
    const now = context.currentTime;
    if (musicBus) {
      const previous = musicBus;
      previous.gain.setTargetAtTime(0, now, .07);
      setTimeout(() => previous.disconnect(), 400);
    }
    musicBus = context.createGain();
    musicBus.gain.setValueAtTime(0, now);
    musicBus.gain.setTargetAtTime(1, now, .06);
    musicBus.connect(volume);
    nextChord = now + .05;
    schedule();
  }

  return {
    setScene(nextScene) {
      if (scene === nextScene) return;
      scene = nextScene;
      chordIndex = 0;
      if (playing) startScene();
    },
    async toggle() {
      if (disposed) return false;
      if (playing) {
        playing = false;
        clearInterval(interval);
        volume.gain.setTargetAtTime(0, context.currentTime, .12);
        return false;
      }
      try {
        if (!context) {
          context = new Audio();
          volume = context.createGain();
          volume.gain.value = 0;
          volume.connect(context.destination);
        }
        await context.resume();
        if (disposed) return false;
        if (playing) return true;
        playing = true;
        volume.gain.setTargetAtTime(.16, context.currentTime, .45);
        startScene();
        interval = setInterval(schedule, 220);
        return true;
      } catch {
        return false;
      }
    },
    cue(name) {
      const sound = cues[name];
      if (!playing || context.state !== 'running' || !sound) return;
      const start = context.currentTime + .03;
      sound.notes.forEach((note, index) => {
        tone(note, start + index * sound.gap, sound.length, sound.level);
      });
    },
    accent() {
      if (!playing) return;
      const start = context.currentTime + .2;
      [48, 60, 67].forEach((note, index) => tone(note, start + index * .14, 3.4, .18));
    },
    dispose() {
      disposed = true;
      clearInterval(interval);
      if (context) void context.close().catch(() => {});
    }
  };
}
