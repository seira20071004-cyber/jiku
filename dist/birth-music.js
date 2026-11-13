const chords = [[48, 55, 62, 64], [45, 52, 59, 60], [41, 48, 55, 57], [43, 50, 57, 62]];
const frequency = note => 440 * 2 ** ((note - 69) / 12);

const cues = {
  navigate: {notes:[76], length:.2, level:.11, gap:0},
  star: {notes:[60, 67, 72], length:1.5, level:.2, gap:.11},
  save: {notes:[67, 72], length:.65, level:.15, gap:.09},
  prize: {notes:[60, 67, 72, 76], length:1.5, level:.2, gap:.12}
};

export function createBirthMusic() {
  const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Audio) return null;

  let context, volume, interval, nextChord, chordIndex = 0, playing = false, disposed = false;

  function tone(note, start, duration, level) {
    const voice = context.createOscillator();
    const envelope = context.createGain();
    voice.frequency.value = frequency(note);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(level, start + duration * .22);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    voice.connect(envelope).connect(volume);
    voice.start(start);
    voice.stop(start + duration);
    voice.onended = () => {voice.disconnect(); envelope.disconnect();};
  }

  function schedule() {
    const now = context.currentTime;
    nextChord = Math.max(now + .05, nextChord);
    if (nextChord > now + .35) return;
    chords[chordIndex].forEach((note, index) => {
      tone(note, nextChord + index * .28, 6.7, index === 0 ? .22 : .12);
    });
    chordIndex = (chordIndex + 1) % chords.length;
    nextChord += 5.6;
  }

  return {
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
        nextChord = context.currentTime + .08;
        schedule();
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
