document.addEventListener('DOMContentLoaded', () => {
    const audioElement = document.getElementById('audio');
    const playButton = document.getElementById('play');
    const prevButton = document.getElementById('prev');
    const nextButton = document.getElementById('next');
    const fileInput = document.getElementById('fileInput');
    const playlistContainer = document.getElementById('playlist');
    const bassControl = document.getElementById('bass');
    const midControl = document.getElementById('mid');
    const trebleControl = document.getElementById('treble');
    const visualizerCanvas = document.getElementById('visualizer');
    const canvasCtx = visualizerCanvas.getContext('2d');
    const lyricsTextarea = document.getElementById('lyrics');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const body = document.body;

    let songs = [];
    let currentTrackIndex = 0;

    // Web Audio API setup
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaElementSource(audioElement);
    const gainNode = audioContext.createGain();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    const bassEQ = audioContext.createBiquadFilter();
    bassEQ.type = 'lowshelf';
    bassEQ.frequency.value = 250;

    const midEQ = audioContext.createBiquadFilter();
    midEQ.type = 'peaking';
    midEQ.frequency.value = 1000;
    midEQ.Q.value = 1;

    const trebleEQ = audioContext.createBiquadFilter();
    trebleEQ.type = 'highshelf';
    trebleEQ.frequency.value = 4000;

    source.connect(bassEQ).connect(midEQ).connect(trebleEQ).connect(gainNode).connect(analyser).connect(audioContext.destination);

    const setEQ = (value, filter) => {
        filter.gain.setValueAtTime(value, audioContext.currentTime);
    };

    bassControl.addEventListener('input', (event) => {
        setEQ(event.target.value, bassEQ);
    });

    midControl.addEventListener('input', (event) => {
        setEQ(event.target.value, midEQ);
    });

    trebleControl.addEventListener('input', (event) => {
        setEQ(event.target.value, trebleEQ);
    });

    // Function to load a specific track
    const loadTrack = (index) => {
        const song = songs[index];
        const url = URL.createObjectURL(song.file);
        audioElement.src = url;
        audioElement.load();
        updatePlaylist(index);
    };

    // Function to update playlist UI
    const updatePlaylist = (currentIndex) => {
        playlistContainer.innerHTML = '';
        songs.forEach((song, index) => {
            const listItem = document.createElement('div');
            listItem.className = `list-group-item list-group-item-action d-flex justify-content-between align-items-center ${index === currentIndex ? 'active' : ''}`;
            listItem.innerHTML = `
                <span>${song.title}</span>
                <div>
                    <button class="btn btn-sm btn-warning edit-btn">Edit</button>
                    <button class="btn btn-sm btn-danger delete-btn">Delete</button>
                </div>
            `;
            listItem.querySelector('.edit-btn').addEventListener('click', () => {
                const newTitle = prompt('Edit song title:', song.title);
                if (newTitle) {
                    songs[index].title = newTitle;
                    updatePlaylist(currentTrackIndex);
                }
            });
            listItem.querySelector('.delete-btn').addEventListener('click', () => {
                songs.splice(index, 1);
                if (currentTrackIndex === index) {
                    currentTrackIndex = 0;
                    if (songs.length > 0) {
                        loadTrack(currentTrackIndex);
                    } else {
                        audioElement.pause();
                        audioElement.src = '';
                    }
                } else if (currentTrackIndex > index) {
                    currentTrackIndex--;
                }
                updatePlaylist(currentTrackIndex);
            });
            listItem.addEventListener('click', () => {
                currentTrackIndex = index;
                loadTrack(currentTrackIndex);
                audioElement.play();
            });
            playlistContainer.appendChild(listItem);
        });
    };

    // Event listener for file input
    fileInput.addEventListener('change', (event) => {
        const files = Array.from(event.target.files);
        files.forEach(file => {
            if (file.type === 'audio/mpeg') {
                songs.push({ title: file.name, file: file });
            }
        });
        if (songs.length > 0) {
            loadTrack(currentTrackIndex);
        }
    });

    // Event listeners for controls
    playButton.addEventListener('click', async () => {
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        if (audioElement.paused) {
            audioElement.play();
            playButton.innerHTML = '<i class="bi bi-pause-fill"></i>';
        } else {
            audioElement.pause();
            playButton.innerHTML = '<i class="bi bi-play-fill"></i>';
        }
    });

    prevButton.addEventListener('click', () => {
        currentTrackIndex = (currentTrackIndex - 1 + songs.length) % songs.length;
        loadTrack(currentTrackIndex);
        audioElement.play();
    });

    nextButton.addEventListener('click', () => {
        currentTrackIndex = (currentTrackIndex + 1) % songs.length;
        loadTrack(currentTrackIndex);
        audioElement.play();
    });

    audioElement.addEventListener('ended', () => {
        nextButton.click();
    });

    // Visualizer
    const drawVisualizer = () => {
        requestAnimationFrame(drawVisualizer);
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        const barWidth = (visualizerCanvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i];
            canvasCtx.fillStyle = `rgb(${barHeight + 100},50,50)`;
            canvasCtx.fillRect(x, visualizerCanvas.height - barHeight / 2, barWidth, barHeight / 2);

            x += barWidth + 1;
        }
    };

    drawVisualizer();

    // Captions or transcripts for lyrics functionality
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');
            lyricsTextarea.value = transcript;
        };

        recognition.onend = () => {
            recognition.start();
        };

        audioElement.addEventListener('play', () => {
            recognition.start();
        });

        audioElement.addEventListener('pause', () => {
            recognition.stop();
        });

        audioElement.addEventListener('ended', () => {
            recognition.stop();
        });
    } else {
        lyricsTextarea.placeholder = 'Speech recognition not supported in this browser.';
    }

    // Dark mode toggle
    darkModeToggle.addEventListener('change', () => {
        body.classList.toggle('dark-mode');
    });
});
