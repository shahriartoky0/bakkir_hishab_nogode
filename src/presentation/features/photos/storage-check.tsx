"use client";

import { useState } from "react";
import { PhotoUpload, type UploadedPhoto } from "./photo-upload";

/** Lets the owner confirm R2 + CORS are configured by uploading a test photo. */
export function StorageCheck() {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  return <PhotoUpload purpose="item" value={photos} onChange={setPhotos} max={2} />;
}
