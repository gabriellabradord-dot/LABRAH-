let cameraStream;

function stopStream(video) {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = undefined;
  if (video) video.srcObject = null;
}

export async function captureAvatar(video, canvas, preview) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('La cámara necesita un navegador compatible y una conexión HTTPS (o localhost).');
  }

  stopStream(video);
  cameraStream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }
  });
  video.srcObject = cameraStream;
  video.hidden = false;
  await video.play();

  if (!video.videoWidth) {
    await new Promise((resolve, reject) => {
      video.addEventListener('loadedmetadata', resolve, { once: true });
      video.addEventListener('error', reject, { once: true });
    });
  }

  const size = Math.min(video.videoWidth, video.videoHeight, 480);
  const x = (video.videoWidth - size) / 2;
  const y = (video.videoHeight - size) / 2;
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d', { alpha: false }).drawImage(video, x, y, size, size, 0, 0, size, size);
  const avatar = canvas.toDataURL('image/jpeg', 0.78);
  const image = document.createElement('img');
  image.src = avatar;
  image.alt = 'Vista previa de tu foto de perfil';
  preview.replaceChildren(image);
  stopStream(video);
  video.hidden = true;
  return avatar;
}
