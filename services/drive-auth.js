const SCOPE = "https://www.googleapis.com/auth/drive.file";

export class DriveAuth {
  constructor(config){
    this.clientId = config?.googleClientId || "";
    this.tokenClient = null;
    this.accessToken = "";
    this.requestId = 0;
  }

  get scope(){
    return SCOPE;
  }

  isConfigured(){
    return Boolean(this.clientId && this.clientId !== "YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com");
  }

  hasToken(){
    return Boolean(this.accessToken);
  }

  async connect({prompt = "consent"} = {}){
    if(!this.isConfigured()) throw new Error("missing-client-id");
    if(!window.google?.accounts?.oauth2) throw new Error("gis-not-loaded");
    if(!this.tokenClient){
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: SCOPE,
        callback: () => {}
      });
    }
    return new Promise((resolve, reject) => {
      const requestId = ++this.requestId;
      this.tokenClient.callback = response => {
        if(requestId !== this.requestId) return;
        if(response.error) reject(new Error(response.error));
        else {
          this.accessToken = response.access_token;
          resolve(response.access_token);
        }
      };
      this.tokenClient.requestAccessToken({prompt});
    });
  }

  cancelPendingRequest(){
    this.requestId += 1;
  }

  disconnect(){
    this.cancelPendingRequest();
    if(this.accessToken && window.google?.accounts?.oauth2){
      google.accounts.oauth2.revoke(this.accessToken, () => {});
    }
    this.accessToken = "";
  }
}
