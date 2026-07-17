

const API_URL = "https://sv8x22dm6h.execute-api.ap-south-1.amazonaws.com/upload";

// ===============================
// HTML Elements
// ===============================

const fileInput = document.getElementById("storyFile");
const uploadBtn = document.getElementById("uploadBtn");
const refreshBtn = document.getElementById("refreshBtn");
const loader = document.getElementById("loader");
const fileName = document.getElementById("fileName");

// ===============================
// Selected File
// ===============================

let selectedFile = null;

const objectInput = document.getElementById("objectImage");
const imagePreview = document.getElementById("imagePreview");
const imageFileName = document.getElementById("imageFileName");
const detectBtn = document.getElementById("detectBtn");
const detectionResult = document.getElementById("detectionResult");

let selectedImageData = null;
let detectorModel = null;
let fallbackModel = null;

// Load object detection models
loadObjectDetector();

// ===============================
// File Selection
// ===============================

fileInput.addEventListener("change", () => {

    if(fileInput.files.length > 0){

        selectedFile = fileInput.files[0];

        fileName.innerHTML = selectedFile.name;

    }

});

// ===============================
// Image Object Detection
// ===============================

objectInput.addEventListener("change", () => {
    if (objectInput.files.length > 0) {
        const file = objectInput.files[0];
        selectedImageData = null;
        imageFileName.innerHTML = file.name;

        const reader = new FileReader();
        reader.onload = (event) => {
            selectedImageData = event.target.result;
            imagePreview.src = selectedImageData;
            detectionResult.innerHTML = "Ready to detect object.";
        };
        reader.readAsDataURL(file);
    }
});

async function loadObjectDetector() {
    try {
        const [cocoModel, mobilenetModel] = await Promise.all([
            cocoSsd.load(),
            mobilenet.load()
        ]);
        detectorModel = cocoModel;
        fallbackModel = mobilenetModel;
        detectionResult.innerHTML = "Object detector is ready. Choose an image to detect.";
        detectBtn.disabled = false;
    } catch (error) {
        detectionResult.innerHTML = "Failed to load object detector.";
        console.error(error);
        detectBtn.disabled = true;
    }
}

detectBtn.addEventListener("click", async () => {
    if (!selectedImageData) {
        alert("Please select an image.");
        return;
    }
    if (!detectorModel || !fallbackModel) {
        alert("Object detector is still loading. Please wait.");
        return;
    }

    detectBtn.disabled = true;
    detectionResult.innerHTML = "Detecting object...";

    const img = new Image();
    img.src = selectedImageData;

    img.onload = async () => {
        try {
            let resultText = "No object detected. Try a different image.";
            let speakMessage = "I could not detect the object. Please try another image.";
            let confidence = 0;
            let label = "object";

            const predictions = await detectorModel.detect(img);
            if (predictions && predictions.length > 0) {
                const best = predictions[0];
                label = best.class || "object";
                confidence = Math.round(best.score * 100);
                if (confidence >= 45) {
                    resultText = `This is a ${label}. (${confidence}% confidence)`;
                    speakMessage = `This is a ${label}.`;
                }
            }

            if (confidence < 45) {
                const fallback = await fallbackModel.classify(img);
                if (fallback && fallback.length > 0) {
                    const bestFallback = fallback[0];
                    const fallbackLabel = bestFallback.className.split(",")[0].trim();
                    const fallbackConfidence = Math.round(bestFallback.probability * 100);
                    if (fallbackConfidence > confidence) {
                        label = fallbackLabel;
                        confidence = fallbackConfidence;
                        resultText = `This is likely a ${label}. (${confidence}% confidence)`;
                        speakMessage = `This is likely a ${label}.`;
                    }
                }
            }

            detectionResult.innerHTML = resultText;
            speakText(speakMessage);
        } catch (error) {
            console.error(error);
            detectionResult.innerHTML = "Could not detect object.";
            speakText("I could not detect the object.");
        } finally {
            detectBtn.disabled = false;
        }
    };

    img.onerror = () => {
        detectionResult.innerHTML = "Unable to load the image preview.";
        detectBtn.disabled = false;
    };
});

function speakText(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith("en") || v.lang.startsWith("en-US"));
    if (voices.length > 0) {
        utterance.voice = voices.find(v => v.lang === "en-US") || voices[0];
    }
    speechSynthesis.speak(utterance);
}

// ===============================
// Upload Story


uploadBtn.addEventListener("click", uploadStory);

async function uploadStory(){

    if(selectedFile == null){

        alert("Please select a story.");

        return;

    }

    if(!selectedFile.name.endsWith(".txt")){

        alert("Only TXT files are allowed.");

        return;

    }

    loader.style.display = "flex";

    uploadBtn.disabled = true;

    try{

        // Read file content
        const storyText = await selectedFile.text();

        const response = await fetch(API_URL,{

            method:"POST",

            headers:{

                "Content-Type":"application/json"

            },

            body:JSON.stringify({

                fileName:selectedFile.name,

                story:storyText

            })

        });

        const result = await response.json();

        console.log(result);

        loader.style.display="none";

        uploadBtn.disabled=false;

        alert("Story uploaded successfully.");

        fileInput.value="";

        selectedFile=null;

        fileName.innerHTML="No file selected";

        // Refresh Story List
        loadStories();

    }

    catch(error){

        console.log(error);

        loader.style.display="none";

        uploadBtn.disabled=false;

        alert("Upload Failed.");

    }

}

// ===============================
// Refresh Button
// ===============================

refreshBtn.addEventListener("click",()=>{

    loadStories();

});

// =======================================
// GET STORIES API
// =======================================

const GET_API = "https://sv8x22dm6h.execute-api.ap-south-1.amazonaws.com/stories";

// Story Container
const storyContainer = document.getElementById("storyContainer");

// Statistics
const storyCount = document.getElementById("storyCount");
const audioCount = document.getElementById("audioCount");

// =======================================
// Load Stories
// =======================================

async function loadStories(){

    try{

        const response = await fetch(GET_API);

        const data = await response.json();

        console.log(data);

        storyContainer.innerHTML = "";

        let totalStories = 0;

        let totalAudio = 0;

        // If Lambda returns:
        // { body: "[...]" }

        let stories = data;

        if(data.body){

            stories = JSON.parse(data.body);

        }

        stories.forEach((story)=>{

            totalStories++;

            totalAudio++;

            createStoryCard(story);

        });

        storyCount.innerHTML = totalStories;

        audioCount.innerHTML = totalAudio;

    }

    catch(error){

        console.log(error);

    }

}

// =======================================
// Create Story Card
// =======================================

function createStoryCard(story){

    const card = document.createElement("div");

    card.className = "story-card";

    card.innerHTML = `

        <div class="story-header">

            <i class="fa-solid fa-book"></i>

            <h3>${story.storyName}</h3>

        </div>

        <div class="story-badges">
            <span class="badge badge-primary"><i class="fa-solid fa-star"></i>Fun Story</span>
            <span class="badge badge-secondary"><i class="fa-solid fa-headphones"></i>Audio Ready</span>
        </div>

        <div class="details">

            <p>

                <i class="fa-solid fa-calendar-days"></i>

                ${story.createdAt}

            </p>

            <p>

                <i class="fa-solid fa-microphone"></i>

                ${story.voice}

            </p>

        </div>

        <audio controls class="audio-player">

            <source
                src="${story.audioUrl}"
                type="audio/mpeg">

        </audio>

        <a
            href="${story.audioUrl}"
            target="_blank"
            class="download-btn">

            <i class="fa-solid fa-download"></i>

            Download Audio

        </a>

    `;

    storyContainer.appendChild(card);

}

// =======================================
// Load Stories Automatically
// =======================================

window.onload = ()=>{

    loadStories();

};

// ========================================
// Toast Notification
// ========================================

function showToast(message, success = true) {

    const toast = document.createElement("div");

    toast.className = "toast";

    toast.innerHTML = message;

    toast.style.position = "fixed";
    toast.style.top = "25px";
    toast.style.right = "25px";
    toast.style.padding = "15px 25px";
    toast.style.borderRadius = "10px";
    toast.style.color = "#fff";
    toast.style.fontWeight = "600";
    toast.style.zIndex = "9999";
    toast.style.boxShadow = "0 5px 20px rgba(0,0,0,.3)";
    toast.style.background = success ? "#16a34a" : "#dc2626";

    document.body.appendChild(toast);

    setTimeout(() => {

        toast.remove();

    }, 3000);

}

// ========================================
// Empty Story Message
// ========================================

function showEmptyMessage(){

    storyContainer.innerHTML = `

        <div
        style="
        width:100%;
        text-align:center;
        padding:50px;
        color:white;
        ">

            <i
            class="fa-solid fa-book-open"
            style="font-size:60px;color:gold"></i>

            <h2>No Stories Uploaded Yet</h2>

            <p>

                Upload your first story to generate an MP3.

            </p>

        </div>

    `;

}

// ========================================
// Update loadStories()
// ========================================

const oldLoadStories = loadStories;

loadStories = async function(){

    try{

        storyContainer.innerHTML = `

        <div
        style="text-align:center;
        width:100%;
        padding:50px;">

            <i
            class="fa-solid fa-spinner fa-spin"
            style="font-size:45px;"></i>

            <h2>Loading Stories...</h2>

        </div>

        `;

        const response = await fetch(GET_API);

        const data = await response.json();

        let stories = data;

        if(data.body){

            stories = JSON.parse(data.body);

        }

        storyContainer.innerHTML = "";

        if(stories.length == 0){

            showEmptyMessage();

            storyCount.innerHTML = 0;

            audioCount.innerHTML = 0;

            return;

        }

        storyCount.innerHTML = stories.length;

        audioCount.innerHTML = stories.length;

        stories.forEach(createStoryCard);

    }

    catch(error){

        console.log(error);

        showToast("Unable to load stories",false);

    }

}

// ========================================
// Update Upload Success
// ========================================

const oldUploadStory = uploadStory;

uploadStory = async function(){

    if(selectedFile==null){

        showToast("Select a TXT file first",false);

        return;

    }

    loader.style.display="flex";

    uploadBtn.disabled=true;

    try{

        const storyText = await selectedFile.text();

        const response = await fetch(API_URL,{

            method:"POST",

            headers:{

                "Content-Type":"application/json"

            },

            body:JSON.stringify({

                fileName:selectedFile.name,

                story:storyText

            })

        });

        await response.json();

        loader.style.display="none";

        uploadBtn.disabled=false;

        fileInput.value="";

        selectedFile=null;

        fileName.innerHTML="No file selected";

        showToast("Story Uploaded Successfully");

        setTimeout(()=>{

            loadStories();

        },3000);

    }

    catch(error){

        loader.style.display="none";

        uploadBtn.disabled=false;

        showToast("Upload Failed",false);

    }

}

// ========================================
// Refresh Button
// ========================================

refreshBtn.addEventListener("click",()=>{

    showToast("Refreshing...");

    loadStories();

});

// ========================================
// Auto Refresh Every 15 Seconds
// ========================================

setInterval(()=>{

    loadStories();

},15000);

// ========================================
// Initial Load
// ========================================

loadStories();