"use strict";
/*
 * Created with @iobroker/create-adapter v1.24.2
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
// Load your modules here, e.g.:
// import * as fs from "fs";
const SerialPort = require("serialport");
class Zisterne extends utils.Adapter {
    constructor(options = {}) {
        super(Object.assign(Object.assign({}, options), { name: "zisterne" }));
        this.updateCycle = 0;
        this.sumDistance = 0;
        this.sumWaterLevel = 0;
        this.day = 0;
        this.dayLevel = 0;
        this.hour = 0;
        this.hourLevel = 0;
        this.prevWaterLevel = 0;
        this.on("ready", this.onReady.bind(this));
        this.on("objectChange", this.onObjectChange.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    onReady() {
        return __awaiter(this, void 0, void 0, function* () {
            // Initialize your adapter here
            // The adapters config (in the instance object everything under the attribute "native") is accessible via
            // this.config:
            this.log.info("config ComPort: " + this.config.comPort);
            this.log.info("config sensorHeight: " + this.config.sensorHeight);
            this.log.info("config cisternDiameter: " + this.config.cisternDiameter);
            this.log.info("config updateCycle: " + this.config.updateCycle);
            this.updateCycle = this.config.updateCycle;
            const port = new SerialPort(this.config.comPort, {
                baudRate: 9600,
                dataBits: 8,
                stopBits: 1,
                parity: "none",
            }, error => {
                if (error !== null) {
                    console.error(error);
                }
            });
            const blp = new SerialPort.parsers.ByteLength({ length: 2 });
            port.pipe(blp);
            blp.on("data", (x) => this.sniff(x));
            /*
            For every state in the system there has to be also an object of type state
            Here a simple template for a boolean variable named "testVariable"
            Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
            */
            yield this.setObjectAsync("distance", {
                type: "state",
                common: {
                    name: "distance",
                    type: "number",
                    role: "value",
                    read: true,
                    write: true,
                },
                native: {},
            });
            yield this.setObjectAsync("waterLevel", {
                type: "state",
                common: {
                    name: "waterLevel",
                    type: "number",
                    role: "value",
                    read: true,
                    write: true,
                },
                native: {},
            });
            yield this.setObjectAsync("timestamp", {
                type: "state",
                common: {
                    name: "timestamp",
                    type: "string",
                    role: "value",
                    read: true,
                    write: true,
                },
                native: {},
            });
            yield this.setObjectAsync("volume", {
                type: "state",
                common: {
                    name: "volume",
                    type: "number",
                    role: "value",
                    read: true,
                    write: true,
                },
                native: {},
            });
            yield this.setObjectAsync("diffPerHour", {
                type: "state",
                common: {
                    name: "diffPerHour",
                    type: "number",
                    role: "value",
                    read: true,
                    write: true,
                },
                native: {},
            });
            yield this.setObjectAsync("diffPerDay", {
                type: "state",
                common: {
                    name: "diffPerDay",
                    type: "number",
                    role: "value",
                    read: true,
                    write: true,
                },
                native: {},
            });
            yield this.setObjectAsync("status", {
                type: "state",
                common: {
                    name: "status",
                    type: "string",
                    role: "value",
                    read: true,
                    write: true,
                },
                native: {},
            });
            // in this template all states changes inside the adapters namespace are subscribed
            this.subscribeStates("*");
            // await this.getStateAsync("volume");
            /*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
            */
            // the variable testVariable is set to true as command (ack=false)
            // await this.setStateAsync("distance", 88);
            // this.setState()
        });
    }
    sniff(data) {
        if (data.length == 2) {
            const distance = data[0] << 8 | data[1];
            const waterLevel = this.config.sensorHeight - distance;
            this.updateCycle--;
            this.sumDistance += distance;
            this.sumWaterLevel += waterLevel;
            if (this.updateCycle == 0) {
                this.updateCycle = this.config.updateCycle;
                this.log.info("sensorHeigth = " + this.config.sensorHeight);
                this.log.info("distance     = " + distance);
                this.log.info("sumDistance 2   = " + this.sumDistance);
                this.log.info("sumDistance check  = " + distance * this.config.updateCycle);
                this.log.info("waterLevel   = " + waterLevel);
                const meanDistance = this.sumDistance / this.config.updateCycle;
                const meanWaterLevel = this.sumWaterLevel / this.config.updateCycle;
                this.sumDistance = 0;
                this.sumWaterLevel = 0;
                // Save distance
                this.log.info("MEAN distance     = " + meanDistance);
                this.setState("distance", Math.round(meanDistance));
                // Save waterLevel
                this.log.info("MEAN waterLevel   = " + meanWaterLevel);
                this.setState("waterLevel", Math.round(meanWaterLevel));
                // Determine status and save
                this.log.info("PREV waterLevel   = " + this.prevWaterLevel);
                if (this.prevWaterLevel > meanWaterLevel) {
                    this.setState("status", "DECREASING");
                }
                else if (this.prevWaterLevel < meanWaterLevel) {
                    this.setState("status", "INCREASING");
                }
                else {
                    this.setState("status", "STABLE");
                }
                // Store new pre level
                this.prevWaterLevel = Math.round(meanWaterLevel);
                // Save the volume in liter
                this.setState("volume", Math.round(meanWaterLevel * Math.PI * Math.pow(this.config.cisternDiameter / 2, 2) / 1000));
                // Get timestamp
                const datum = new Date();
                this.setState("timestamp", datum.toLocaleString());
                this.log.info(datum.toLocaleString());
                // Calc the leveldifference of the last hour
                if (datum.getHours() != this.hour) {
                    // new hour, if not initialized
                    if (this.hourLevel != 0) {
                        this.setState("diffPerHour", this.hourLevel - Math.round(meanWaterLevel));
                    }
                    this.hourLevel = Math.round(meanWaterLevel);
                    this.hour = datum.getHours();
                }
                // Calc the leveldifference of the last day
                if (datum.getDay() != this.day) {
                    // new hour, if not initialized
                    if (this.dayLevel != 0) {
                        this.setState("diffPerDay", this.dayLevel - Math.round(meanWaterLevel));
                    }
                    this.dayLevel = Math.round(meanWaterLevel);
                    this.day = datum.getDay();
                }
            }
        }
    }
    ;
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            this.log.info("cleaned everything up...");
            callback();
        }
        catch (e) {
            callback();
        }
    }
    /**
     * Is called if a subscribed object changes
     */
    onObjectChange(id, obj) {
        if (obj) {
            // The object was changed
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        }
        else {
            // The object was deleted
            this.log.info(`object ${id} deleted`);
        }
    }
    /**
     * Is called if a subscribed state changes
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        }
        else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }
}
if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options) => new Zisterne(options);
}
else {
    // otherwise start the instance directly
    (() => new Zisterne())();
}
