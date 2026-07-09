const fs = require('fs');
let code = fs.readFileSync('src/screens/UnifiedRegistration.tsx', 'utf8');

const target = `  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);`;

const replacement = `  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const batchList = await BatchService.getAllBatches();
        setBatches(batchList.filter(b => b.status === 'active'));
      } catch (err) {
        console.error("Failed to load batches:", err);
      }
    };
    fetchBatches();
  }, []);
  
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);`;

code = code.replace(target, replacement);
fs.writeFileSync('src/screens/UnifiedRegistration.tsx', code);
console.log("Patched UnifiedRegistration variables");
