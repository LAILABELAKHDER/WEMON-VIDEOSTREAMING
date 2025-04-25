(function () {
    var url = "http://localhost:8000/playlist.mpd";
    var player = dashjs.MediaPlayer().create();
    var video = document.querySelector("#videoPlayer");

    var isFinalPlaybackEnded = false;
    
    player.initialize(video, url, true);

    var startupStartTime = null;
    var reelTimeMetrics = [];
    var finalMetrics = {};
    video.addEventListener('click', function () {
        if (startupStartTime === null) {
            startupStartTime = performance.now();
            console.log("User clicked – startup timer started at: " + startupStartTime + " ms");
        }
    });

    
    player.on(dashjs.MediaPlayer.events.PLAYBACK_STARTED, function () {
        if (startupStartTime !== null) {
            var startupTime = performance.now() - startupStartTime;
            document.getElementById('startup').innerText = startupTime.toFixed(0);
            console.log("Startup time: " + startupTime.toFixed(0) + " ms");
        }
    });

    var eventPoller = setInterval(function () {
        var streamInfo = player.getActiveStream()?.getStreamInfo();
        var dashMetrics = player.getDashMetrics();
        var dashAdapter = player.getDashAdapter();
        
        if (dashMetrics && streamInfo) {
            const periodIdx = streamInfo.index;
            var repSwitch = dashMetrics.getCurrentRepresentationSwitch('video', true);
            var bufferLevel = dashMetrics.getCurrentBufferLevel('video', true);
            var bitrate = repSwitch ? Math.round(dashAdapter.getBandwidthForRepresentation(repSwitch.to, periodIdx) / 1000) : "N/A";
            
            var adaptation = dashAdapter.getAdaptationForType(periodIdx, 'video', streamInfo);
            var currentRep = adaptation?.Representation_asArray?.find(rep => rep.id === repSwitch?.to);
            
            var frameRate = currentRep?.frameRate || "N/A";
            var resolution = currentRep ? `${currentRep.width}x${currentRep.height}` : "N/A";

            reelTimeMetrics.push({
                bufferLevel,
                bitrate, // = Reported Bitrate
                resolution,
                frameRate,
                startupTime: startupStartTime ? (performance.now() - startupStartTime).toFixed(0) : "N/A",
                rebufferRatio: document.getElementById('rebufferRatio')?.innerText || "N/A",
                videoStartFailure: document.getElementById('videoStartFailure')?.innerText || "N/A",
                weightedAverageBitrate: document.getElementById('weightedAverage')?.innerText || "N/A",
                stallCount: document.getElementById('stallCount')?.innerText || "N/A",
                qualitySwitchCount: document.getElementById('qualitySwitchCount')?.innerText || "N/A",
                calculatedBitrate: document.getElementById('calculatedBitrate')?.innerText || "N/A"
            });

            document.getElementById('bufferLevel').innerText = bufferLevel ? bufferLevel.toFixed(2) : "N/A";
            document.getElementById('reportedBitrate').innerText = bitrate;
            document.getElementById('resolution').innerText = resolution;
            document.getElementById('framerate').innerText = frameRate;

            
        }
    }, 1000);
    var totalPlaybackTime = 0;   
    var totalRebufferTime = 0;   
    var lastStateChangeTime = performance.now()
    var currentState = null;     

    
player.on(dashjs.MediaPlayer.events.PLAYBACK_STARTED, function () {
    currentState = "playing";
    lastStateChangeTime = performance.now();
    console.log("PLAYBACK_STARTED à " + lastStateChangeTime + " ms");
});


player.on(dashjs.MediaPlayer.events.BUFFER_EMPTY, function () {
    if (currentState === "playing") {
        var now = performance.now();
        totalPlaybackTime += now - lastStateChangeTime;
        lastStateChangeTime = now;
        currentState = "buffering";
        console.log("BUFFER_EMPTY à " + now + " ms – passage en état 'buffering'");
    }
});

player.on(dashjs.MediaPlayer.events.BUFFER_LOADED, function () {
    if (currentState === "buffering") {
        var now = performance.now();
        totalRebufferTime += now - lastStateChangeTime;
        lastStateChangeTime = now;
        currentState = "playing";
        console.log("BUFFER_LOADED à " + now + " ms – reprise en état 'playing'");
    }
});


player.on(dashjs.MediaPlayer.events.PLAYBACK_PAUSED, function () {
    if (currentState === "playing") {
        var now = performance.now();
        totalPlaybackTime += now - lastStateChangeTime;
    }
    currentState = "paused";
    console.log("PLAYBACK_PAUSED à " + performance.now() + " ms");
});


video.addEventListener("playing", function () {
    if (currentState === "paused") {
        currentState = "playing";
        lastStateChangeTime = performance.now();
        console.log("Reprise de lecture ('playing') à " + lastStateChangeTime + " ms");
    }
});


player.on(dashjs.MediaPlayer.events.PLAYBACK_ENDED, function () {
    var now = performance.now();
    if (currentState === "playing") {
        totalPlaybackTime += now - lastStateChangeTime;
    } else if (currentState === "buffering") {
        totalRebufferTime += now - lastStateChangeTime;
    }
    var totalDuration = totalPlaybackTime + totalRebufferTime;
    var rebufferRatio = totalDuration > 0 ? (totalRebufferTime / totalDuration) * 100 : 0;
    document.getElementById('rebufferRatio').innerText = rebufferRatio.toFixed(2);
    console.log("PLAYBACK_ENDED – Temps de lecture : " + totalPlaybackTime.toFixed(0) + " ms, Temps de re‑buffering : " + totalRebufferTime.toFixed(0) + " ms, Ratio : " + rebufferRatio.toFixed(2) + "%");

    clearInterval(eventPoller);
    clearInterval(bitrateCalculator);
});


function saveJSON(dataObj, filename) {
    const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: "application/json;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

var firstVideoChunkDelivered = false;
    var videoStartFailureTimeout = null;
    var cutoffTime = 10000; 

    player.on(dashjs.MediaPlayer.events.PLAYBACK_STARTED, function () {
        videoStartFailureTimeout = setTimeout(function () {
            if (!firstVideoChunkDelivered) {
                document.getElementById('videoStartFailure').innerText = "Yes";
                console.log("Video Start Failure – Premier segment non reçu en moins de 10 secondes");
            }
        }, cutoffTime);
    });

    // Dès que le premier fragment vidéo est entièrement chargé, on annule le timer
    player.on(dashjs.MediaPlayer.events.FRAGMENT_LOADING_COMPLETED, function (e) {
        if (e.request && e.request.mediaType === "video" && !firstVideoChunkDelivered) {
            firstVideoChunkDelivered = true;
            if (videoStartFailureTimeout) {
                clearTimeout(videoStartFailureTimeout);
            }
            document.getElementById('videoStartFailure').innerText = "No";
            console.log("Premier fragment vidéo reçu – Pas de Video Start Failure");
        }
    });


    var wabTracker = {
        currentQualityIndex: null, // indice de la qualité actuellement affichée
        qualityStartTimeMs: 0,       // heure de début de cette qualité (ms)
        sumBitrateTime: 0,           // somme cumulée de (bitrate * temps joué) en bits
        totalPlayTime: 0             // temps total joué en secondes
    };

    
    function getBitrateForQualityIndex(qualityIndex) {
        var bitrateInfoList = player.getBitrateInfoListFor("video");
        if (bitrateInfoList && bitrateInfoList[qualityIndex]) {
            return bitrateInfoList[qualityIndex].bitrate;
        }
        return 0;
    }

  
    function updateWAB() {
        var wabElement = document.getElementById("weightedAverage");
        if (wabTracker.totalPlayTime > 0) {
            // Calcul en bits/sec puis conversion en Kbps pour affichage
            var wabBps = wabTracker.sumBitrateTime / wabTracker.totalPlayTime;
            var wabKbps = wabBps / 1000;
            wabElement.innerText = wabKbps.toFixed(0);
        } else {
            wabElement.innerText = "-";
        }
    }


    player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, function(e) {
        var now = performance.now();
        if (wabTracker.currentQualityIndex !== null) {
            var elapsedMs = now - wabTracker.qualityStartTimeMs;
            var elapsedSec = elapsedMs / 1000;
            var oldBitrate = getBitrateForQualityIndex(wabTracker.currentQualityIndex);
            wabTracker.sumBitrateTime += oldBitrate * elapsedSec;
            wabTracker.totalPlayTime += elapsedSec;
        }
      
        wabTracker.currentQualityIndex = e.newQuality;
        wabTracker.qualityStartTimeMs = now;
        updateWAB();
    });

    player.on(dashjs.MediaPlayer.events.PLAYBACK_ENDED, function() {
        var now = performance.now();
        if (wabTracker.currentQualityIndex !== null) {
            var elapsedSec = (now - wabTracker.qualityStartTimeMs) / 1000;
            var oldBitrate = getBitrateForQualityIndex(wabTracker.currentQualityIndex);
            wabTracker.sumBitrateTime += oldBitrate * elapsedSec;
            wabTracker.totalPlayTime += elapsedSec;
        }
        updateWAB();
    });




var qualitySwitchCount = 0;

player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, function(e) {
var now = performance.now();

if (wabTracker.currentQualityIndex !== null) {
    // Clôture du segment précédent pour le calcul du WAB
    var elapsedMs = now - wabTracker.qualityStartTimeMs;
    var elapsedSec = elapsedMs / 1000;
    var oldBitrate = getBitrateForQualityIndex(wabTracker.currentQualityIndex);
    wabTracker.sumBitrateTime += oldBitrate * elapsedSec;
    wabTracker.totalPlayTime += elapsedSec;
    qualitySwitchCount++;
    document.getElementById("qualitySwitchCount").innerText = qualitySwitchCount;
    console.log("Quality switch detected. Total quality switches: " + qualitySwitchCount);
}
// Mise à jour du quality index et de l'heure de début pour la nouvelle qualité
wabTracker.currentQualityIndex = e.newQuality;
wabTracker.qualityStartTimeMs = now;
updateWAB();
});

player.on(dashjs.MediaPlayer.events.PLAYBACK_ENDED, function() {
var now = performance.now();
if (wabTracker.currentQualityIndex !== null) {
    var elapsedSec = (now - wabTracker.qualityStartTimeMs) / 1000;
    var oldBitrate = getBitrateForQualityIndex(wabTracker.currentQualityIndex);
    wabTracker.sumBitrateTime += oldBitrate * elapsedSec;
    wabTracker.totalPlayTime += elapsedSec;
}
updateWAB();
});


var stallCount = 0;
var isStalling = false; // Flag pour éviter le double comptage

// Lorsqu'on détecte un stall via BUFFER_EMPTY
player.on(dashjs.MediaPlayer.events.BUFFER_EMPTY, function() {
    if (!isStalling) {
        stallCount++;
        isStalling = true;
        console.log("Stall detected via BUFFER_EMPTY. Total stalls: " + stallCount);
        document.getElementById('stallCount').innerText = stallCount;
    }
});

// Lorsqu'on détecte un stall via PLAYBACK_STALLED
player.on(dashjs.MediaPlayer.events.PLAYBACK_STALLED, function() {
    if (!isStalling) {
        stallCount++;
        isStalling = true;
        console.log("Stall detected via PLAYBACK_STALLED. Total stalls: " + stallCount);
        document.getElementById('stallCount').innerText = stallCount;
    }
});

// Réinitialisation du flag lorsque le buffer est rechargé ou la lecture démarre
player.on(dashjs.MediaPlayer.events.BUFFER_LOADED, function() {
    if (isStalling) {
        isStalling = false;
        console.log("Stall ended via BUFFER_LOADED");
    }
});
player.on(dashjs.MediaPlayer.events.PLAYBACK_STARTED, function() {
    if (isStalling) {
        isStalling = false;
        console.log("Stall ended via PLAYBACK_STARTED");
    }
});


    if (video.webkitVideoDecodedByteCount !== undefined) {
        var lastDecodedByteCount = 0;
        const bitrateInterval = 5;
        var bitrateCalculator = setInterval(function () {
            var calculatedBitrate = (((video.webkitVideoDecodedByteCount - lastDecodedByteCount) / 1000) * 8) / bitrateInterval;
            document.getElementById('calculatedBitrate').innerText = Math.round(calculatedBitrate) + " Kbps";
            lastDecodedByteCount = video.webkitVideoDecodedByteCount;
        }, bitrateInterval * 1000);
    } else {
        document.getElementById('chrome-only').style.display = "none";
    }

    player.on(dashjs.MediaPlayer.events["PLAYBACK_ENDED"], function () {
        clearInterval(eventPoller);
        clearInterval(bitrateCalculator);
    });

    video.addEventListener("ended", function () {
        // On peut utiliser le flag si vous voulez être sûr d’envoyer une seule fois
        if (!isFinalPlaybackEnded) {
            isFinalPlaybackEnded = true;
            console.log("La vidéo est terminée – envoi des métriques");

        let finalMetrics = {
           
            bufferLevel: document.getElementById('bufferLevel') ? document.getElementById('bufferLevel').innerText.trim() : "N/A",
            reportedBitrate: document.getElementById('reportedBitrate') ? document.getElementById('reportedBitrate').innerText.trim() : "N/A",
            resolution: document.getElementById('resolution') ? document.getElementById('resolution').innerText.trim() : "N/A",
            frameRate: document.getElementById('framerate') ? document.getElementById('framerate').innerText.trim() : "N/A",
            startupTime: document.getElementById('startup') ? document.getElementById('startup').innerText.trim() : "N/A",
            rebufferRatio: document.getElementById('rebufferRatio') ? document.getElementById('rebufferRatio').innerText.trim() : "N/A",
            videoStartFailure: document.getElementById('videoStartFailure') ? document.getElementById('videoStartFailure').innerText.trim() : "N/A",
            weightedAverageBitrate: document.getElementById('weightedAverage') ? document.getElementById('weightedAverage').innerText.trim() : "N/A",
            stallCount: document.getElementById('stallCount') ? document.getElementById('stallCount').innerText.trim() : "N/A",
            qualitySwitchCount: document.getElementById('qualitySwitchCount') ? document.getElementById('qualitySwitchCount').innerText.trim() : "N/A",
            calculatedBitrate: document.getElementById('calculatedBitrate') ? document.getElementById('calculatedBitrate').innerText.trim() : "N/A"
        };

        fullMetrics = { reel_time_metrics: reelTimeMetrics, final_metrics: finalMetrics }
        console.log("fullMetrics")
        console.log(fullMetrics)
        saveJSON(fullMetrics, "videoMetrics.json");

        
        chrome.runtime.sendMessage({ type: "videoMetrics", data: fullMetrics }, function(response) {
            console.log("Réponse du background.js :", response);
        });

        clearInterval(eventPoller);
        clearInterval(bitrateCalculator);
    }
}, 2000); 

    

})();