const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";
const FILE_NAME = "cardflow-data.json";

function multipartBody(metadata, payload){
  const boundary = "cardflow_boundary";
  return {
    contentType: `multipart/related; boundary=${boundary}`,
    body: [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(payload, null, 2),
      `--${boundary}--`
    ].join("\r\n")
  };
}

export class DriveRepository {
  constructor(auth){
    this.auth = auth;
  }

  async request(url, options = {}){
    if(!this.auth.hasToken()) await this.auth.connect({prompt:""});
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.auth.accessToken}`,
        ...(options.headers || {})
      }
    });
    if(!response.ok){
      const text = await response.text();
      throw new Error(`drive-${response.status}: ${text}`);
    }
    return response.status === 204 ? null : response.json();
  }

  async findDataFile({signal} = {}){
    const params = new URLSearchParams({
      q: `name='${FILE_NAME}' and trashed=false`,
      spaces: "drive",
      fields: "files(id,name,modifiedTime,size)"
    });
    const result = await this.request(`${DRIVE_API}?${params}`, {signal});
    return result.files?.[0] || null;
  }

  async readFile(fileId, {signal} = {}){
    return this.request(`${DRIVE_API}/${fileId}?alt=media`, {signal});
  }

  async createFile(payload, {signal} = {}){
    const parts = multipartBody({name:FILE_NAME, mimeType:"application/json"}, payload);
    return this.request(`${UPLOAD_API}?uploadType=multipart&fields=id,name,modifiedTime`, {
      method: "POST",
      signal,
      headers: {"Content-Type": parts.contentType},
      body: parts.body
    });
  }

  async updateFile(fileId, payload, {signal} = {}){
    const parts = multipartBody({name:FILE_NAME, mimeType:"application/json"}, payload);
    return this.request(`${UPLOAD_API}/${fileId}?uploadType=multipart&fields=id,name,modifiedTime`, {
      method: "PATCH",
      signal,
      headers: {"Content-Type": parts.contentType},
      body: parts.body
    });
  }

  async createBackup(payload, {signal} = {}){
    const stamp = new Date().toISOString().slice(0,10);
    const parts = multipartBody({name:`cardflow-data-backup-${stamp}.json`, mimeType:"application/json"}, payload);
    return this.request(`${UPLOAD_API}?uploadType=multipart&fields=id,name,modifiedTime`, {
      method: "POST",
      signal,
      headers: {"Content-Type": parts.contentType},
      body: parts.body
    });
  }
}
