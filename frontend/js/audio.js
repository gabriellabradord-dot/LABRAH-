let audioContext;

export function playCue(type = 'click') {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext ||= new AudioContextClass();
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});

  const notes = type === 'compra' ? [523.25, 659.25, 783.99, 1046.5] : type === 'exito' ? [659.25, 880] : [420];
  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = audioContext.currentTime + index * (type === 'compra' ? 0.12 : 0.09);
    oscillator.type = type === 'clic' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(type === 'clic' ? 0.035 : 0.08, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + (type === 'clic' ? 0.055 : 0.22));
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + (type === 'clic' ? 0.06 : 0.24));
  });
}

export function initAudio() {
  document.addEventListener('click', (event) => {
    if (event.target.closest('button, .button, .filter-chip')) playCue('clic');
  });
}
