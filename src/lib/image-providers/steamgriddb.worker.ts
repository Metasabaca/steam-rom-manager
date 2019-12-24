import { GenericProvider, GenericProviderManager, ProviderProxy } from "./generic-provider";
import { xRequestWrapper } from "./x-request-wrapper";
const SGDB = require("steamgriddb");
import * as Bluebird from 'bluebird';
declare global { export interface Promise<T> extends Bluebird<T> {} }

class SteamGridDbProvider extends GenericProvider {
  private xrw: xRequestWrapper;
  private client: any;

  constructor(protected proxy: ProviderProxy) {
    super(proxy);
    this.xrw = new xRequestWrapper(proxy, true, 3, 3000);
    console.log(typeof(SGDB));
    this.client = new SGDB({key: "f80f92019254471cca9d62ff91c21eee"});
  }

  // retrieveUrls() {
  //   this.xrw.promise = this.xrw.get('https://steamgriddb.com/api/grids', {
  //     game: this.proxy.title,
  //     fields: ['author', 'grid_url'].toString()
  //   }).then((response) => {
  //     if (response !== null && response['data'] !== undefined) {
  //       for (let i = 0; i < response['data'].length; i++) {
  //         this.proxy.image({
  //           imageProvider: 'SteamGridDB',
  //           imageUrl: response['data'][i].grid_url,
  //           imageUploader: response['data'][i].author,
  //           loadStatus: 'notStarted'
  //         });
  //       }
  //     }
  //   }).catch((error) => {
  //     this.xrw.logError(error);
  //   }).finally(() => {
  //     this.proxy.completed();
  //   });
  // }
  retrieveUrls() {
    let self = this;
    this.xrw.promise = new this.xrw.Bluebird<string>(function (resolve, reject, onCancel) {
      self.client.searchGame(self.proxy.title).then((res: any)=>{
        self.client.getGridsById(res[0].id,undefined,self.proxy.imageType=="long"?["legacy","460x215"]:["600x900"]).then((res: any)=>{
          if(res !== null && res.length>0) {
            console.log(res);
            for (let i=0; i < res.length; i++) {
              self.proxy.image({
                imageProvider: 'SteamGridDB',
                imageUrl: res[i].url,
                imageUploader: res[i].author.name,
                loadStatus: 'notStarted'
              });
            }
            self.proxy.completed();
            resolve();
          }
        })
      }).catch((error: string) => {
        self.xrw.logError(error);
        self.proxy.completed();
        resolve();
      });
      onCancel(()=>{
        return;
      });
    });
  }

  stopUrlDownload() {
    this.xrw.cancel();
  }
}

new GenericProviderManager(SteamGridDbProvider, 'SteamGridDB');
