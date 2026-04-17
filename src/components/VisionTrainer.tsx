import React, { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as knnClassifier from '@tensorflow-models/knn-classifier';
import { Upload, Plus, Trash2, Cpu, BrainCircuit, Image as ImageIcon, Loader2 } from 'lucide-react';

const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = URL.createObjectURL(file);
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
  });
};

export default function VisionTrainer() {
  const [isReady, setIsReady] = useState(false);
  const [modelStatus, setModelStatus] = useState('Initializing AI engine...');
  const [groups, setGroups] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [sampleCounts, setSampleCounts] = useState<Record<string, number>>({});
  
  const [testImageBlob, setTestImageBlob] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<{label: string, confidence: number}[]>([]);
  const [isPredicting, setIsPredicting] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null); // Which group is processing

  const classifierRef = useRef<knnClassifier.KNNClassifier | null>(null);
  const mobilenetRef = useRef<mobilenet.MobileNet | null>(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await tf.ready();
        classifierRef.current = knnClassifier.create();
        mobilenetRef.current = await mobilenet.load();
        setIsReady(true);
        setModelStatus('AI Vision Core Ready');
      } catch (err) {
        console.error(err);
        setModelStatus('Failed to load Vision Core. Check connection.');
      }
    };
    loadModels();
    
    return () => {
      // Memory cleanup if component unmounts
      if (classifierRef.current) {
        classifierRef.current.dispose();
      }
    }
  }, []);

  const addGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newGroupName.trim();
    if (cleanName && !groups.includes(cleanName)) {
      setGroups([...groups, cleanName]);
      setNewGroupName('');
      setSampleCounts(prev => ({ ...prev, [cleanName]: 0 }));
    }
  };

  const handleGroupUpload = async (group: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (!classifierRef.current || !mobilenetRef.current) return;
    
    setIsUploading(group);
    const files = Array.from(e.target.files) as File[];
    
    try {
      for (const file of files) {
        const img = await loadImage(file);
        // Pass true to get intermediate activations for transfer learning
        const activation = mobilenetRef.current.infer(img, true);
        classifierRef.current.addExample(activation, group);
        URL.revokeObjectURL(img.src);
      }
      
      setSampleCounts(prev => ({
        ...prev,
        [group]: (prev[group] || 0) + files.length
      }));
    } catch (err) {
      console.error("Error adding examples:", err);
    } finally {
      setIsUploading(null);
      // Reset input
      e.target.value = '';
    }
  };

  const handleTestUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (!classifierRef.current || !mobilenetRef.current) return;
    
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    setTestImageBlob(url);
    setIsPredicting(true);
    setPredictions([]);
    
    try {
      const img = await loadImage(file);
      const activation = mobilenetRef.current.infer(img, true);
      
      // If no examples, it will throw an error
      if (classifierRef.current.getNumClasses() === 0) {
        alert("Please train the model with at least one group first.");
        setIsPredicting(false);
        return;
      }

      const result = await classifierRef.current.predictClass(activation);
      
      const preds = Object.entries(result.confidences).map(([label, conf]) => ({
        label,
        confidence: conf as number
      })).sort((a, b) => b.confidence - a.confidence);
      
      setPredictions(preds);
    } catch (err) {
      console.error("Prediction Error:", err);
    } finally {
      setIsPredicting(false);
      e.target.value = '';
    }
  };

  const removeGroup = (group: string) => {
    setGroups(groups.filter(g => g !== group));
    const newCounts = { ...sampleCounts };
    delete newCounts[group];
    setSampleCounts(newCounts);
    
    if (classifierRef.current) {
        // We have to recreate it to "remove" a class effectively, 
        // or just clear the specific class if API supports it.
        try {
            classifierRef.current.clearClass(group);
        } catch (e) {
            console.log("Error clearing class", e);
        }
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto w-full max-w-6xl mx-auto p-6 gap-6">
      
      <div className="bg-[#15181E] border border-[#2D333B] rounded-2xl p-6 shadow-lg shadow-black/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-[#F0F6FC] uppercase tracking-wider flex items-center gap-2">
              <BrainCircuit className="text-[#3B82F6]" /> Vision Training Lab
            </h2>
            <p className="text-[#8B949E] text-sm mt-1">Train a local AI model by grouping images. Your data never leaves the browser.</p>
          </div>
          <div className={`px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${
            isReady ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20' : 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20'
          }`}>
            {!isReady && <Loader2 className="w-3 h-3 animate-spin" />}
            {modelStatus}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          {/* Training Section */}
          <div className="flex flex-col gap-6 md:border-r border-[#2D333B] md:pr-8">
            <h3 className="text-lg font-semibold text-[#F0F6FC] border-b border-[#2D333B] pb-2">1. Define Classes & Gather Data</h3>
            
            <form onSubmit={addGroup} className="flex gap-2">
              <input
                type="text"
                placeholder="New group name (e.g., Cat, Invoice, Defect)"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                className="flex-1 bg-[#0A0C10] border border-[#2D333B] rounded-xl px-4 py-3 text-sm text-[#F0F6FC] focus:outline-none focus:border-[#3B82F6]"
              />
              <button
                type="submit"
                disabled={!newGroupName.trim()}
                className="bg-[#3B82F6] hover:bg-[#2563EB] text-white px-4 py-2 rounded-xl transition-all disabled:opacity-50"
              >
                <Plus className="w-5 h-5" />
              </button>
            </form>

            <div className="flex flex-col gap-3">
              {groups.length === 0 && (
                <div className="text-center py-8 text-[#8B949E] border border-dashed border-[#2D333B] rounded-xl">
                  No tracking classes yet. Define a group above.
                </div>
              )}
              {groups.map(group => (
                <div key={group} className="flex flex-col gap-3 p-4 bg-[#0A0C10] border border-[#2D333B] rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#F0F6FC] uppercase tracking-wider">{group}</span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="bg-[#2D333B] text-[#F0F6FC] px-2 py-1 rounded-md font-mono">
                        {sampleCounts[group] || 0} samples
                      </span>
                      <button onClick={() => removeGroup(group)} className="text-red-500 hover:bg-red-500/20 p-1 rounded-md transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/30 py-2 rounded-lg cursor-pointer transition-colors text-sm font-semibold select-none group relative overflow-hidden">
                      {isUploading === group ? (
                        <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Training Model...</span>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" /> Upload Training Data
                          <input 
                            type="file" 
                            multiple 
                            accept="image/*"
                            className="hidden" 
                            onChange={(e) => handleGroupUpload(group, e)}
                            disabled={!isReady || isUploading !== null}
                          />
                        </>
                      )}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Testing Section */}
          <div className="flex flex-col gap-6">
            <h3 className="text-lg font-semibold text-[#F0F6FC] border-b border-[#2D333B] pb-2">2. Live Testing & Analysis</h3>
            
            <label className={`w-full flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
              !isReady || groups.length === 0 ? 'border-[#2D333B] text-[#4B5563] cursor-not-allowed' : 'border-[#3B82F6]/50 text-[#3B82F6] hover:bg-[#3B82F6]/5'
            }`}>
              <Cpu className={`w-10 h-10 ${isPredicting ? 'animate-pulse' : ''}`} />
              <span className="font-bold uppercase tracking-widest text-sm">
                {isPredicting ? 'Analyzing Matrix...' : 'Upload Image to Test'}
              </span>
              <input 
                type="file" 
                accept="image/*"
                className="hidden" 
                onChange={handleTestUpload}
                disabled={!isReady || isPredicting || groups.length === 0}
              />
            </label>

            {testImageBlob && (
              <div className="mt-4 p-4 bg-[#0A0C10] border border-[#2D333B] rounded-xl flex flex-col gap-6">
                <div className="w-full flex justify-center bg-black rounded-lg overflow-hidden border border-[#2D333B]">
                  <img src={testImageBlob} alt="Test" className="max-h-60 object-contain" />
                </div>
                
                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-[#8B949E] uppercase tracking-widest mb-1">Prediction Matrix</h4>
                  {predictions.length === 0 && isPredicting && (
                    <div className="h-8 flex items-center gap-2 text-[#3B82F6] text-sm font-mono">
                      <Loader2 className="w-4 h-4 animate-spin" /> Computing tensors...
                    </div>
                  )}
                  {predictions.map((pred, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#F0F6FC] font-semibold">{pred.label}</span>
                        <span className="text-[#10B981] font-mono">{(pred.confidence * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-[#1C2128] rounded-full h-2 overflow-hidden shadow-inner">
                        <div 
                          className="bg-[#10B981] h-full transition-all duration-1000 ease-out" 
                          style={{ width: `${pred.confidence * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
