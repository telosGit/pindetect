window.addEventListener('pinstate', e => {
  console.log('Pinned?', e.detail.verdict, 'score=', e.detail.score);
  if (e.detail.verdict === 'LIKELY_PINNED') {
    document.body.classList.add('pinned-mode');
  }
});