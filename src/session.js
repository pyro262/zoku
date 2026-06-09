const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CAR_CLASSES = ['D', 'C', 'B', 'A', 'S1', 'S2', 'X'];
const DRIVETRAIN = ['FWD', 'RWD', 'AWD'];

class SessionRecorder {
  constructor() {
    this.frames = [];
    this.recording = false;
    this.startMeta = null;
    // Only record one frame per ~50ms to keep file sizes sane
    this.lastFrameTime = 0;
    this.FRAME_INTERVAL_MS = 50;
  }

  start(data) {
    this.frames = [];
    this.recording = true;
    this.lastFrameTime = 0;
    this.startMeta = {
      startedAt: new Date().toISOString(),
      carOrdinal: data.carOrdinal,
      carClass: CAR_CLASSES[data.carClass] ?? 'Unknown',
      carPI: data.carPI,
      drivetrain: DRIVETRAIN[data.drivetrainType] ?? 'Unknown',
      numCylinders: data.numCylinders,
    };
    console.log('Session recording started');
  }

  addFrame(data) {
    if (!this.recording) return;
    const now = Date.now();
    if (now - this.lastFrameTime < this.FRAME_INTERVAL_MS) return;
    this.lastFrameTime = now;

    this.frames.push({
      t:     data.currentRaceTime,
      lap:   data.lapNumber,
      x:     data.posX,
      y:     data.posY,
      z:     data.posZ,
      spd:   +(data.speed * 2.23694).toFixed(1),  // m/s → mph
      rpm:   Math.round(data.currentEngineRpm),
      gear:  data.gear,
      thr:   data.accel,
      brk:   data.brake,
      ttFL:  +data.tireTempFL.toFixed(1),
      ttFR:  +data.tireTempFR.toFixed(1),
      ttRL:  +data.tireTempRL.toFixed(1),
      ttRR:  +data.tireTempRR.toFixed(1),
      suFL:  +data.suspNormFL.toFixed(3),
      suFR:  +data.suspNormFR.toFixed(3),
      suRL:  +data.suspNormRL.toFixed(3),
      suRR:  +data.suspNormRR.toFixed(3),
    });
  }

  stop() {
    if (!this.recording || this.frames.length === 0) {
      this.recording = false;
      return null;
    }
    this.recording = false;

    // Trim trailing zero frames emitted during raceEnd debounce window
    while (this.frames.length > 0) {
      const last = this.frames[this.frames.length - 1];
      if (last.t === 0 && last.x === 0 && last.z === 0) this.frames.pop();
      else break;
    }
    if (this.frames.length === 0) return null;

    const session = {
      version: 1,
      meta: {
        ...this.startMeta,
        savedAt: new Date().toISOString(),
        frameCount: this.frames.length,
        durationSec: this.frames.at(-1)?.t ?? 0,
      },
      frames: this.frames,
    };

    const dir = path.join(app.getPath('documents'), 'Zoku', 'sessions');
    fs.mkdirSync(dir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    const filename = `session_${ts}.json`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, JSON.stringify(session));
    console.log('Session saved:', filepath);
    return filepath;
  }

  isRecording() {
    return this.recording;
  }
}

module.exports = new SessionRecorder();
