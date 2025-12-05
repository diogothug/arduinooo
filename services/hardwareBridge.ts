
/* eslint-disable @typescript-eslint/no-explicit-any */

// Constants for BLE
const SERVICE_UUID = '12345678-1234-1234-1234-1234567890ab';
const CHARACTERISTIC_UUID = '87654321-4321-4321-4321-ba0987654321';

let serialPort: any = null;
let serialWriter: any = null;
let bluetoothDevice: any = null;
let bluetoothCharacteristic: any = null;

export const hardwareBridge = {
  // --- USB SERIAL ---
  connectUSB: async (): Promise<boolean> => {
    if (!('serial' in navigator)) {
      throw new Error("Web Serial not supported in this browser. Try Chrome or Edge.");
    }
    try {
      // @ts-ignore
      serialPort = await navigator.serial.requestPort();
      await serialPort.open({ baudRate: 115200 });
      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(serialPort.writable);
      serialWriter = textEncoder.writable.getWriter();
      return true;
    } catch (err: any) {
      console.error("USB Connect Error:", err);
      if (err.name === 'NotFoundError') {
          // User cancelled the prompt
          return false;
      }
      throw new Error(err.message || "Failed to open serial port");
    }
  },

  disconnectUSB: async () => {
    try {
        if (serialWriter) {
          await serialWriter.close();
          serialWriter = null;
        }
        if (serialPort) {
          await serialPort.close();
          serialPort = null;
        }
    } catch(e) {
        console.warn("Error closing USB:", e);
    }
  },

  // --- BLUETOOTH BLE ---
  connectBLE: async (): Promise<string | null> => {
    if (!('bluetooth' in navigator)) {
      throw new Error("Web Bluetooth not supported in this browser.");
    }
    try {
      // @ts-ignore
      bluetoothDevice = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'MareLED' }],
        optionalServices: [SERVICE_UUID]
      });

      const server = await bluetoothDevice.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      bluetoothCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
      
      return bluetoothDevice.name;
    } catch (err: any) {
      console.error("BLE Connect Error:", err);
      if (err.name === 'NotFoundError') {
          // User cancelled
          return null;
      }
      throw new Error(err.message || "Failed to connect via BLE");
    }
  },

  disconnectBLE: () => {
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
      bluetoothDevice.gatt.disconnect();
    }
    bluetoothDevice = null;
    bluetoothCharacteristic = null;
  },

  // --- UNIFIED SEND ---
  sendData: async (data: any, type: 'USB' | 'BLE' | 'WIFI', ip?: string) => {
    const jsonString = JSON.stringify(data);
    
    if (type === 'USB') {
      if (!serialWriter) throw new Error("USB not connected");
      // Add newline for SerialManager.cpp readline
      await serialWriter.write(jsonString + "\n"); 
    } 
    else if (type === 'BLE') {
      if (!bluetoothCharacteristic) throw new Error("BLE not connected");
      const encoder = new TextEncoder();
      const chunks = chunkString(jsonString, 500); // chunking might be needed for MTU
      for (const chunk of chunks) {
         await bluetoothCharacteristic.writeValue(encoder.encode(chunk));
      }
    } 
    else if (type === 'WIFI') {
      if (!ip) throw new Error("No IP address");
      const response = await fetch(`http://${ip}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonString
      });
      if (!response.ok) throw new Error("WiFi sync failed");
    }
  }
};

function chunkString(str: string, length: number) {
  return str.match(new RegExp('.{1,' + length + '}', 'g')) || [];
}
