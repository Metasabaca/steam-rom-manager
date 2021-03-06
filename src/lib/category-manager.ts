import { PreviewData } from "../models";
import * as genericParser from '@node-steam/vdf';
import * as steam from './helpers/steam';
import * as SteamCategories from 'steam-categories';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';

export class CategoryManager {
  private data: object = {};

  createList() {
    const list = [];
    for (let steamDirectory in this.data) {
      for (let userId in this.data[steamDirectory]) {
        list.push({
          userId,
          steamDirectory,
          userData: this.data[steamDirectory][userId]
        });
      }
    }
    return list;
  }

  writeCat(data: { userId: string, steamDirectory: string, userData: any }) {
    return new Promise<void>((resolve, reject) => {
      const { userId, steamDirectory, userData } = data;
      let levelDBPath: string;
      if(os.type()=="Windows_NT") {
        levelDBPath = path.join(process.env.localappdata,'Steam','htmlcache','Local Storage','leveldb');
      } else {
        levelDBPath = path.join(steamDirectory,'config','htmlcache','Local Storage','leveldb');
      }
      const cats = new SteamCategories(levelDBPath, userId);
      cats.read().then(() => {
        const localConfigPath = path.join(steamDirectory, 'userdata', userId, 'config', 'localconfig.vdf');
        const localConfig = genericParser.parse(fs.readFileSync(localConfigPath, 'utf-8'));

        let collections = {};
        if (localConfig.UserLocalConfigStore.WebStorage['user-collections']) {
          collections = JSON.parse(localConfig.UserLocalConfigStore.WebStorage['user-collections'].replace(/\\/g, ''));
        }

        for (const appId of Object.keys(userData.apps)) {
          const app = userData.apps[appId];
          const appIdNew = parseInt(steam.generateNewAppId(app.executableLocation, app.title), 10);

          // Loop "steamCategories" and make a new category from each
          app.steamCategories.forEach((catName: string) => {

            // Create new category if it doesn't exist
            const catKey = `srm-${catName}`; // just use the name as the id
            const platformCat = cats.get(catKey);
            if (platformCat.is_deleted || !platformCat) {
              cats.add(catKey, {
                name: catName,
                added: [],
              });
            }

            // Create entries in localconfig.vdf
            if (!collections[catKey]) {
              collections[catKey] = {
                id: catKey,
                added: [],
                removed: [],
              };
            }

            // Add appids to localconfig.vdf
            if (collections[catKey].added.indexOf(appIdNew) === -1) {
              // Only add if it doesn't exist already
              collections[catKey].added.push(appIdNew);
            }
          });
        }

        cats.save().then(() => {
          localConfig.UserLocalConfigStore.WebStorage['user-collections'] = JSON.stringify(collections).replace(/"/g, '\\"'); // I hate Steam
          const newVDF = genericParser.stringify(localConfig);
          fs.writeFileSync(localConfigPath, newVDF);
          cats.close().then(() => {
            return resolve();
          })
        });

      }).catch((error: any) => {
        // Ignore not found
        if (error.type === 'NotFoundError') {
          cats.close().then(() => {
            resolve();
          });
        } else {
          cats.close();
          reject(error);
        }
      });
    });
  }

  save(PreviewData: PreviewData) {
    return new Promise((resolveSave, rejectSave) => {
      this.data = PreviewData;

      let result = this.createList().reduce((accumulatorPromise, nextUser) => {
        return accumulatorPromise.then(() => {
          return this.writeCat(nextUser);
        });
      }, Promise.resolve());

      return result.then(() => {
        resolveSave();
      }).catch((error: any) => {
        rejectSave(error);
      });
    });
  }
}
