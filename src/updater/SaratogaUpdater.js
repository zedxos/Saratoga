const Fetch = require('node-fetch');
const SaratogaUtil = require('../util/SaratogaUtil');
const SaratogaValidator = require('./SaratogaValidator');

class SaratogaUpdater {
    constructor(store, saratoga) {
        this.saratoga = saratoga;
        this.store = store;
        this.dataDirReady = false;
        this.startUpCheck();
    }

    // a sync method to avoid accessing files that doesn't exist
    startUpCheck() {
        if (this.dataDirReady) return;
        if (!SaratogaUtil.existSync(SaratogaUtil.folderDataPath())) SaratogaUtil.createDirectorySync(SaratogaUtil.folderDataPath());
        for (const prop of ['versionFilePath', 'shipFilePath', 'equipFilePath']) {
            if (!SaratogaUtil.existSync( SaratogaUtil[prop]() )) SaratogaUtil.writeFileSync(SaratogaUtil[prop](), JSON.stringify({}));
        }
        this.dataDirReady = true;
    }

    async updateDataAndCache() {
        await this.updateLocalData();
        await this.updateCache();
    }

    async checkForUpdate() {
        const dataValidator = new SaratogaValidator();
        await dataValidator.fetch(false);
        const shipUpdateAvailable = dataValidator.setType('ships').needsUpdate();
        const equipmentUpdateAvailable = dataValidator.setType('equipments').needsUpdate();
        return { shipUpdateAvailable, equipmentUpdateAvailable };
    }

    async updateLocalData() {
        const dataValidator = new SaratogaValidator();
        await dataValidator.fetch();
        if (dataValidator.noLocalData()) {
            await this.updateStoredShips();
            await this.updateStoredEquipments();
            await dataValidator.updateVersionFile();
        } else {
            if (dataValidator.setType('ships').needsUpdate()) {
                await this.updateStoredShips();
                await dataValidator.updateVersionFile();
            }
            if (dataValidator.setType('equipments').needsUpdate()) {
                await this.updateStoredEquipments();
                await dataValidator.updateVersionFile();
            }
        }
    }

    async updateCache() {
        this.store.loadShipsCache(await this.fetchShipsFromLocal());
        this.store.loadEquipmentsCache(await this.fetchEquipmentsFromLocal());
        console.log(`Loaded ${this.store._shipCache.length} ships from ${SaratogaUtil.shipFilePath()}.`);
        console.log(`Loaded ${this.store._equipCache.length} equipments from ${SaratogaUtil.equipFilePath()}`);
    }

    async updateStoredShips() {
        await this.store.clearShipsData();
        await this.store.updateShipsData(await this.fetchShipsFromRemote());
    }

    async updateStoredEquipments() {
        await this.store.clearEquipmentsData();
        await this.store.updateEquipmentsData(await this.fetchEquipmentsFromRemote());
    }

    fetchShipsFromRemote() {
        return Fetch(SaratogaUtil.latestShipDataLink()).then(data => data.text());
    }

    fetchEquipmentsFromRemote() {
        return Fetch(SaratogaUtil.latestEquipmentDataLink()).then(data => data.text());
    }

    fetchShipsFromLocal() {
        return SaratogaUtil.readFile(SaratogaUtil.shipFilePath()).then(data => JSON.parse(data));
    }

    fetchEquipmentsFromLocal() {
        return SaratogaUtil.readFile(SaratogaUtil.equipFilePath()).then(data => JSON.parse(data));
    }
}
module.exports = SaratogaUpdater;