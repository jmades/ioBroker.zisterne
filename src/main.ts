/*
 * Created with @iobroker/create-adapter v1.24.2
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";

// Load your modules here, e.g.:
// import * as fs from "fs";
import SerialPort = require("serialport");

// Augment the adapter.config object with the actual types
// TODO: delete this in the next version
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace ioBroker {
        interface AdapterConfig {
            // Define the shape of your options here (recommended)
            comPort: string;
            sensorHeight: number;
            cisternDiameter: number;
            updateCycle: number;
        }
    }
}

class Zisterne extends utils.Adapter {

    private updateCycle = 0;
    private sumDistance = 0;
    private sumWaterLevel = 0;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: "zisterne",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("objectChange", this.onObjectChange.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        // Initialize your adapter here

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        this.log.info("config ComPort: " + this.config.comPort);
        this.log.info("config sensorHeight: " + this.config.sensorHeight);
        this.log.info("config cisternDiameter: " + this.config.cisternDiameter);
        this.log.info("config updateCycle: " + this.config.updateCycle);
        
        this.updateCycle = this.config.updateCycle;

        const port: SerialPort = new SerialPort(this.config.comPort, {
            baudRate: 9600,
            dataBits: 8,
            stopBits: 1,
            parity: "none",
        },
        error => {
            if (error !== null) {
                console.error(error);
            }
        }

        );

        const blp = new SerialPort.parsers.ByteLength({length: 2});

        port.pipe(blp);
        blp.on("data", (x)=>this.sniff(x));


        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */
        await this.setObjectAsync("distance", {
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

        await this.setObjectAsync("waterLevel", {
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
        // in this template all states changes inside the adapters namespace are subscribed
        this.subscribeStates("*");

        /*
        setState examples
        you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
        */
        // the variable testVariable is set to true as command (ack=false)
        // await this.setStateAsync("distance", 88);
        // this.setState()

      
    }

    private sniff(data: Buffer): void // for reading
    {
        if(data.length == 2)
        {
            const distance: number = data[0]<<8 | data[1];
            const waterLevel: number = this.config.sensorHeight - distance;
     
            this.updateCycle--;
            this.sumDistance += distance;
            this.sumWaterLevel += waterLevel;

            if(this.updateCycle==0)
            {
                this.updateCycle = this.config.updateCycle;
                this.log.info("sensorHeigth = "+this.config.sensorHeight);
                this.log.info("distance     = "+distance);
                this.log.info("sumDistance 2   = "+this.sumDistance);
                this.log.info("sumDistance check  = "+distance*this.config.updateCycle);
                this.log.info("waterLevel   = "+waterLevel);

                const meanDistance: number = this.sumDistance/this.config.updateCycle;
                const meanWaterLevel: number = this.sumWaterLevel/this.config.updateCycle;
                this.sumDistance = 0;
                this.sumWaterLevel = 0;

                this.log.info("MEAN distance     = " + meanDistance);
                this.log.info("MEAN waterLevel   = " + meanWaterLevel);
                
                this.setState("distance", Math.round(meanDistance));
                this.setState("waterLevel", Math.round(meanWaterLevel));
            }
        }
    };


    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    private onUnload(callback: () => void): void {
        try {
            this.log.info("cleaned everything up...");
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed object changes
     */
    private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
        if (obj) {
            // The object was changed
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            this.log.info(`object ${id} deleted`);
        }
    }

    /**
     * Is called if a subscribed state changes
     */
    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  */
    // private onMessage(obj: ioBroker.Message): void {
    // 	if (typeof obj === "object" && obj.message) {
    // 		if (obj.command === "send") {
    // 			// e.g. send email or pushover or whatever
    // 			this.log.info("send command");

    // 			// Send response in callback if required
    // 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
    // 		}
    // 	}
    // }

}

if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Zisterne(options);
} else {
    // otherwise start the instance directly
    (() => new Zisterne())();
}