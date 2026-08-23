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

  isReady(){
    return this.isConfigured() && Boolean(window.google?.accounts?.oauth2);
  }

  toAuthError(source, details = {}){
    const code = details.error || details.type || details.message || source;
    const error = new Error(code);
    error.code = code;
    error.source = source;
    error.details = {
      error: details.error,
      error_description: details.error_description,
      error_uri: details.error_uri,
      type: details.type
    };
    return error;
  }

  async connect({prompt} = {}){
    if(!this.isConfigured()) throw new Error("missing-client-id");
    if(!window.google?.accounts?.oauth2) throw new Error("gis-not-loaded");
    if(!this.tokenClient){
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: SCOPE,
        callback: () => {},
        error_callback: () => {}
      });
    }
    return new Promise((resolve, reject) => {
      const requestId = ++this.requestId;
      this.tokenClient.callback = response => {
        if(requestId !== this.requestId) return;
        if(response.error) reject(this.toAuthError("token_callback", response));
        else {
          this.accessToken = response.access_token;
          resolve(response.access_token);
        }
      };
      this.tokenClient.error_callback = error => {
        if(requestId !== this.requestId) return;
        reject(this.toAuthError("error_callback", error || {}));
      };
      const requestOptions = prompt ? {prompt} : {};
      this.tokenClient.requestAccessToken(requestOptions);
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
