const dgram = require('dgram');
const { EventEmitter } = require('events');

const PACKET_SIZE = 324;

function parsePacket(buf) {
  if (buf.length < PACKET_SIZE) return null;

  return {
    // Sled
    isRaceOn:             buf.readInt32LE(0),
    timestampMS:          buf.readUInt32LE(4),
    engineMaxRpm:         buf.readFloatLE(8),
    engineIdleRpm:        buf.readFloatLE(12),
    currentEngineRpm:     buf.readFloatLE(16),
    accelX:               buf.readFloatLE(20),
    accelY:               buf.readFloatLE(24),
    accelZ:               buf.readFloatLE(28),
    velocityX:            buf.readFloatLE(32),
    velocityY:            buf.readFloatLE(36),
    velocityZ:            buf.readFloatLE(40),
    angVelX:              buf.readFloatLE(44),
    angVelY:              buf.readFloatLE(48),
    angVelZ:              buf.readFloatLE(52),
    yaw:                  buf.readFloatLE(56),
    pitch:                buf.readFloatLE(60),
    roll:                 buf.readFloatLE(64),
    suspNormFL:           buf.readFloatLE(68),
    suspNormFR:           buf.readFloatLE(72),
    suspNormRL:           buf.readFloatLE(76),
    suspNormRR:           buf.readFloatLE(80),
    tireSlipRatioFL:      buf.readFloatLE(84),
    tireSlipRatioFR:      buf.readFloatLE(88),
    tireSlipRatioRL:      buf.readFloatLE(92),
    tireSlipRatioRR:      buf.readFloatLE(96),
    wheelSpeedFL:         buf.readFloatLE(100),
    wheelSpeedFR:         buf.readFloatLE(104),
    wheelSpeedRL:         buf.readFloatLE(108),
    wheelSpeedRR:         buf.readFloatLE(112),
    suspTravelMetersFL:   buf.readFloatLE(196),
    suspTravelMetersFR:   buf.readFloatLE(200),
    suspTravelMetersRL:   buf.readFloatLE(204),
    suspTravelMetersRR:   buf.readFloatLE(208),
    carOrdinal:           buf.readInt32LE(212),
    carClass:             buf.readInt32LE(216),
    carPI:                buf.readInt32LE(220),
    drivetrainType:       buf.readInt32LE(224),
    numCylinders:         buf.readInt32LE(228),
    // FH6-specific
    carGroup:             buf.readUInt32LE(232),
    smashableVelDiff:     buf.readFloatLE(236),
    smashableMass:        buf.readFloatLE(240),
    // Dash
    posX:                 buf.readFloatLE(244),
    posY:                 buf.readFloatLE(248),
    posZ:                 buf.readFloatLE(252),
    speed:                buf.readFloatLE(256),  // m/s
    power:                buf.readFloatLE(260),  // watts
    torque:               buf.readFloatLE(264),  // N·m
    tireTempFL:           buf.readFloatLE(268),  // °F
    tireTempFR:           buf.readFloatLE(272),
    tireTempRL:           buf.readFloatLE(276),
    tireTempRR:           buf.readFloatLE(280),
    boost:                buf.readFloatLE(284),
    fuel:                 buf.readFloatLE(288),
    distanceTraveled:     buf.readFloatLE(292),
    bestLap:              buf.readFloatLE(296),
    lastLap:              buf.readFloatLE(300),
    currentLap:           buf.readFloatLE(304),
    currentRaceTime:      buf.readFloatLE(308),
    lapNumber:            buf.readUInt16LE(312),
    racePosition:         buf.readUInt8(314),
    accel:                buf.readUInt8(315),    // 0-255
    brake:                buf.readUInt8(316),    // 0-255
    clutch:               buf.readUInt8(317),
    handBrake:            buf.readUInt8(318),
    gear:                 buf.readUInt8(319),    // 0=reverse, 11=neutral
    steer:                buf.readInt8(320),     // -127 to 127
  };
}

class FH6Telemetry extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.inRace = false;
    // Debounce race-end: FH6 briefly drops raceTime to 0 between laps
    this.raceEndTimer = null;
    this.RACE_END_DEBOUNCE_MS = 3000;
  }

  start(port = 20777) {
    this.socket = dgram.createSocket('udp4');

    this.socket.on('error', (err) => {
      console.error('UDP error:', err);
    });

    this.socket.on('message', (buf) => {
      const data = parsePacket(buf);
      if (!data) return;

      this.emit('telemetry', data);

      // Non-lap races (sprint, point-to-point) have lapNumber=0 but racePosition>0
      const raceActive = data.currentRaceTime > 0 && (data.lapNumber > 0 || data.racePosition > 0);

      if (raceActive && !this.inRace) {
        if (this.raceEndTimer) {
          clearTimeout(this.raceEndTimer);
          this.raceEndTimer = null;
        }
        this.inRace = true;
        this.emit('raceStart', data);
      } else if (!raceActive && this.inRace && !this.raceEndTimer) {
        // Debounce: wait before declaring race over
        this.raceEndTimer = setTimeout(() => {
          this.raceEndTimer = null;
          this.inRace = false;
          this.emit('raceEnd', data);
        }, this.RACE_END_DEBOUNCE_MS);
      } else if (raceActive && this.raceEndTimer) {
        clearTimeout(this.raceEndTimer);
        this.raceEndTimer = null;
      }
    });

    this.socket.bind(port, '0.0.0.0', () => {
      console.log(`UDP listening on port ${port}`);
    });
  }

  stop() {
    if (this.raceEndTimer) clearTimeout(this.raceEndTimer);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

module.exports = new FH6Telemetry();
