function msePlay(videoEl, mseUrl) {
    const mseQueue = []
    let mseSourceBuffer
    let mseStreamingStarted = false

    function startPlay(videoEl, url) {
        const mse = new MediaSource()
        videoEl.src = window.URL.createObjectURL(mse)
        mse.addEventListener('sourceopen', function () {
            const ws = new WebSocket(url)
            ws.binaryType = 'arraybuffer'
            ws.onopen = function (event) {
                console.log('Connect to ws')
            }
            ws.onmessage = function (event) {
                const data = new Uint8Array(event.data)
                if (data[0] === 9) {
                    let mimeCodec
                    const decodedArr = data.slice(1)
                    if (window.TextDecoder) {
                        mimeCodec = new TextDecoder('utf-8').decode(decodedArr)
                    } else {
                        mimeCodec = Utf8ArrayToStr(decodedArr)
                    }
                    mseSourceBuffer = mse.addSourceBuffer('video/mp4; codecs="' + mimeCodec + '"')
                    mseSourceBuffer.mode = 'segments'
                    mseSourceBuffer.addEventListener('updateend', pushPacket)
                } else {
                    readPacket(event.data)
                }
            }
        }, false)
    }

    function pushPacket() {
        let packet

        if (!mseSourceBuffer.updating) {
            if (mseQueue.length > 0) {
                packet = mseQueue.shift()
                mseSourceBuffer.appendBuffer(packet)
            } else {
                mseStreamingStarted = false
            }
        }
        if (videoEl.buffered.length > 0) {
            if (typeof document.hidden !== 'undefined' && document.hidden) {
                // no sound, browser paused video without sound in background
                videoEl.currentTime = videoEl.buffered.end((videoEl.buffered.length - 1)) - 0.5
            }
        }
    }

    function readPacket(packet) {
        if (!mseStreamingStarted) {
            mseSourceBuffer.appendBuffer(packet)
            mseStreamingStarted = true
            return
        }
        mseQueue.push(packet)
        if (!mseSourceBuffer.updating) {
            pushPacket()
        }
    }

    // fix stalled video in safari
    videoEl.addEventListener('pause', () => {
        if (videoEl.currentTime > videoEl.buffered.end(videoEl.buffered.length - 1)) {
            videoEl.currentTime = videoEl.buffered.end(videoEl.buffered.length - 1) - 0.1
            videoEl.play()
        }
    });

    startPlay(videoEl, mseUrl);
}

document.addEventListener('DOMContentLoaded', function () {

    const params = new Proxy(new URLSearchParams(window.location.search), {
        get: (searchParams, prop) => searchParams.get(prop),
    });

    const custom = params.custom;
    const baseUrl = params.baseUrl;
    const uid = params.uid;

    if (custom == null || custom == '') {
        const videoEl = document.querySelector('#video');
        msePlay(videoEl, `${baseUrl}/stream/${uid}/channel/0/mse?uuid=${uid}&channel=0`);
    } else {
        const videoEl = document.querySelector('#video');
        msePlay(videoEl, `${custom}`);
    }
})
