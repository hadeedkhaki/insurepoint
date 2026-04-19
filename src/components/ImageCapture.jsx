import { useState, useRef, useCallback } from 'react';
import { readImageFile, IMAGE_ACCEPT } from '../utils/imageUpload';

export default function ImageCapture({ onImageReady, disabled }) {
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [activeSide, setActiveSide] = useState('front');
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await readImageFile(file);
      if (activeSide === 'front') {
        setFrontPreview(dataUrl);
        onImageReady(dataUrl, backPreview);
      } else {
        setBackPreview(dataUrl);
        onImageReady(frontPreview, dataUrl);
      }
    } catch (err) {
      alert(err.message || 'Could not read image');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      alert('Could not access camera. Please check permissions.');
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    if (activeSide === 'front') {
      setFrontPreview(dataUrl);
      onImageReady(dataUrl, backPreview);
    } else {
      setBackPreview(dataUrl);
      onImageReady(frontPreview, dataUrl);
    }
    stopCamera();
  };

  const reset = () => {
    setFrontPreview(null);
    setBackPreview(null);
    setActiveSide('front');
    onImageReady(null, null);
    stopCamera();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const currentPreview = activeSide === 'front' ? frontPreview : backPreview;

  return (
    <div className="capture-section">
      <div className="side-tabs">
        <button
          className={`side-tab ${activeSide === 'front' ? 'active' : ''}`}
          onClick={() => { stopCamera(); setActiveSide('front'); }}
          disabled={disabled}
        >
          Front of Card {frontPreview && '✓'}
        </button>
        <button
          className={`side-tab ${activeSide === 'back' ? 'active' : ''}`}
          onClick={() => { stopCamera(); setActiveSide('back'); }}
          disabled={disabled}
        >
          Back of Card {backPreview && '✓'}
        </button>
      </div>

      {!currentPreview && !cameraActive && (
        <div className="capture-buttons">
          <label className="btn btn-primary">
            Upload {activeSide === 'front' ? 'Front' : 'Back'}
            <input
              ref={fileInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              onChange={handleFile}
              hidden
              disabled={disabled}
            />
          </label>
          <button className="btn btn-secondary" onClick={startCamera} disabled={disabled}>
            Use Camera
          </button>
        </div>
      )}

      {cameraActive && (
        <div className="camera-container">
          <video ref={videoRef} autoPlay playsInline className="camera-video" />
          <div className="camera-actions">
            <button className="btn btn-primary" onClick={capturePhoto}>Capture</button>
            <button className="btn btn-secondary" onClick={stopCamera}>Cancel</button>
          </div>
        </div>
      )}

      {currentPreview && !cameraActive && (
        <div className="preview-container">
          <img src={currentPreview} alt={`${activeSide} of insurance card`} className="preview-image" />
        </div>
      )}

      {(frontPreview || backPreview) && (
        <div className="capture-footer">
          {!backPreview && activeSide === 'front' && frontPreview && (
            <p className="capture-hint">Tip: Tap "Back of Card" to also scan the back for more details.</p>
          )}
          <button className="btn btn-secondary btn-sm" onClick={reset} disabled={disabled}>
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
