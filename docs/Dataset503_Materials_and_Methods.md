# Materials and Methods

## Study Population and Data Collection

This retrospective study was approved by the institutional review board, and the requirement for informed consent was waived. 

### Training Dataset Construction

The training dataset was constructed from an institutional rectal cancer cohort previously established for a predictive model study on cancer recurrence [1]. Patients were classified according to the presence or absence of hepatic metastasis based on the metastasis records in the original cohort database.

For patients with hepatic metastasis (positive cases), radiology reports were reviewed to identify the date when hepatic metastasis was first detected. The corresponding contrast-enhanced abdominal CT was designated as the follow-up CT, and the most recent prior CT without metastasis was designated as the baseline CT. For patients without hepatic metastasis (negative cases), two consecutive contrast-enhanced abdominal CT examinations were selected.

Inclusion criteria were as follows: (a) portal venous phase images included in both examinations and (b) one CT pair per patient to ensure statistical independence. Exclusion criteria included (a) severe motion artifacts, (b) incomplete liver coverage, and (c) prior hepatic interventions between baseline and follow-up examinations. After applying the inclusion and exclusion criteria, the final training dataset consisted of 466 patients, as summarized in Figure 1.

### Test Dataset Construction

The test dataset was constructed independently from the training dataset using a temporally separated, consecutive cohort. All patients who underwent contrast-enhanced abdominal CT examinations including the portal venous phase at the Department of Medical Oncology between September and October 2024 were initially identified. Case categorization was performed using a two-step process: initial automated screening using a large language model followed by verification by a board-certified radiologist (Supplementary Methods).

Each case was classified according to hepatic metastasis status: NEW (newly developed metastasis), EXIST (persistent metastasis from baseline), NEGATIVE (no metastasis), or UNCERTAIN (indeterminate findings). Only NEW and NEGATIVE cases were included to evaluate the model's ability to detect newly developed hepatic metastases. Cases categorized as EXIST or UNCERTAIN were excluded.

To ensure adequate statistical power for positive cases, the test dataset was enriched by retrospectively collecting additional NEW cases from November–December 2024 and July–August 2023 using the same inclusion criteria. A total of 70 positive (NEW) cases and 986 sequential negative cases from the consecutive cohort were available for test set construction.

### Test Set Structure

The test dataset was partitioned into subsets with distinct purposes:

**Primary Test Set (n=270)**: For primary model evaluation and performance reporting. This set comprised 70 positive cases and 200 negative cases randomly sampled from the 986 sequential negative cohort.

**Holdout Set (n=786)**: The remaining 786 negative cases were reserved to validate that the model's operating point remains robust in a large-scale consecutive negative population.

**Reader Study Subset (n=120)**: For comparison with radiologist performance, 120 cases (40 positive, 80 negative; ratio 1:2) were selected from the entire available test pool. Positive cases were stratified by lesion size (≤5 mm, 5–10 mm, >10 mm), and negative cases were randomly sampled.


## CT Image Acquisition

All CT examinations were performed using five different multi-detector CT scanners from two vendors with tube voltage of 80–120 kVp and automatic exposure control. Portal venous phase images were acquired 70–80 seconds after intravenous administration of iodinated contrast material. Images were reconstructed with a slice thickness of 3 or 5 mm using a soft-tissue kernel, with in-plane matrix size of 512 × 512 pixels. Detailed acquisition parameters including scanner models, contrast agents, and reconstruction protocols are provided in Supplementary Table 1.

## Image Registration

To enable voxel-wise comparison between baseline and follow-up examinations, deformable image registration was performed using ANTsPy, the Python interface to the Advanced Normalization Tools (ANTs) software package [2]. The registration pipeline utilized symmetric diffeomorphic transformation (SyN) with an adaptive multi-method approach to optimize alignment quality.

The baseline CT images were warped to the follow-up image space, and registration quality was assessed by computing the Dice coefficient between fixed and warped liver masks. Detailed registration parameters and fallback strategies are provided in Supplementary Methods.

## Reference Standard

Initial segmentation of the liver and hepatic lesions was performed using a pre-trained nnU-Net model [3] trained on the LiTS dataset [4]. The automated segmentation results were subsequently reviewed and corrected by a board-certified abdominal radiologist (10 years of experience). This semi-automated approach with a consistent algorithmic baseline was adopted to reduce inter-observer variability compared to fully manual segmentation. To assess consistency of the reference standard, metastatic lesion segmentation in a random subset of test cases (20%) was independently reviewed by a second board-certified abdominal radiologist. All visible hepatic metastases were included regardless of size. Benign lesions such as hepatic cysts, hemangiomas, and focal fat depositions were labeled as liver parenchyma (label value = 1) to focus on clinically relevant metastatic detection and minimize labeling ambiguity, whereas metastases were labeled separately (label value = 2).

## Deep Learning Model Development

We employed the nnU-Net framework (version 2.0), a self-configuring method for biomedical image segmentation [5]. The framework automatically configured a 3D U-Net architecture optimized for the anisotropic voxel spacing of abdominal CT images.

The model received three input channels: (a) the registered baseline CT image, (b) the follow-up CT image, and (c) a subtraction image computed as the voxel-wise difference between follow-up and baseline images. All images were intensity-clipped to [-150, 250] HU prior to input. The subtraction channel provided explicit temporal change information, enabling the model to detect newly developed lesions.

The model was trained from scratch using five-fold cross-validation with stratified sampling on four NVIDIA RTX A5000 GPUs (24 GB each). Training utilized a combination of Dice loss and cross-entropy loss with deep supervision. To reduce false positives from pre-existing benign lesions, a temporal consistency loss was added that penalizes predictions also present in the baseline image. Foreground oversampling (67%) was applied to address class imbalance. Detailed training hyperparameters and data augmentation strategies are provided in Supplementary Table 2.

## Inference and Post-processing

During inference, the trained ensemble model (five folds) generated voxel-wise predictions with test-time augmentation by mirroring along all three axes. Softmax probability maps for the metastasis class were computed by averaging predictions across all folds. Post-processing included connected component analysis to identify individual lesions and removal of predicted lesions smaller than 50 mm³ to reduce false positives from noise.

## Performance Evaluation

Model performance was evaluated at three levels: voxel, lesion, and patient. Voxel-level segmentation accuracy was assessed using the Dice similarity coefficient (DSC). Lesion-level detection was evaluated using sensitivity (recall), precision, and F1-score. A true positive detection was defined as a predicted lesion with at least 10% volumetric overlap with a reference lesion. Patient-level classification was assessed using sensitivity, specificity, positive predictive value (PPV), negative predictive value (NPV), and accuracy. The area under the receiver operating characteristic curve (AUC) was calculated using the maximum softmax probability per patient as the continuous prediction score.

To investigate the trade-off between sensitivity and false positive rate, softmax probability threshold analysis was performed at multiple cutoff values. Volume-stratified analysis was conducted to evaluate size-dependent detection performance, with lesions categorized into three groups: small (< 500 mm³), medium (500–2000 mm³), and large (> 2000 mm³). Additional subgroup analysis by 100 mm³ intervals was performed for small lesions to identify the detection threshold.

Error analysis was performed by identifying cases with the highest false positive and false negative counts, and lesion characteristics (volume, location, softmax probability) were analyzed to investigate patterns of model errors.

## Reader Study Design

A reader study was conducted to evaluate the impact of AI assistance on radiologist performance in detecting newly developed hepatic lesions, using the reader study subset described above. Six readers participated in the study: three board-certified radiologists specializing in abdominal imaging and three radiology residents. All cases were presented in a randomized order, and readers were blinded to the prevalence of positive cases and to any clinical outcome information. To mitigate expectation and learning effects, cases were distributed across multiple reading sessions with randomized composition. Radiologists interpreted each case under two conditions, without AI assistance and with AI assistance, using a paired crossover design with an appropriate washout period between reading sessions. Reader performance was evaluated primarily by patient-level sensitivity for newly developed lesions under the two reading conditions.

## Statistical Analysis

Continuous variables were expressed as mean ± standard deviation or median with interquartile range, as appropriate. Categorical variables were expressed as frequencies and percentages. Inter-observer agreement for the reference standard was quantified using the DSC. The 95% confidence intervals for performance metrics were calculated using the bootstrap method with 1000 resamples. For the reader study, paired comparisons of reader performance between readings without and with AI assistance were conducted using the McNemar test for patient-level sensitivity. Absolute differences and 95% confidence intervals were reported. All statistical tests were two-sided, and P < 0.05 was considered statistically significant. Statistical analyses were performed using Python (version 3.10) with SciPy (version 1.15) and scikit-learn (version 1.7).

---

## References

1. Yeo, D.M., Oh, S.N., Lee, M.A. et al. The development and validation of a predictive model for recurrence in rectal cancer based on radiological and clinicopathological data. Eur Radiol 2021;31:8586-8596. https://doi.org/10.1007/s00330-021-07920-y

2. Avants BB, Tustison NJ, Song G, et al. A reproducible evaluation of ANTs similarity metric performance in brain image registration. Neuroimage 2011;54:2033-2044.

3. Murugesan GK, Van Oss J, McCrumb D. Pretrained model for 3D semantic image segmentation of the liver and liver lesions from CT scan. Zenodo. 2024. https://doi.org/10.5281/zenodo.11582728.

4. Bilic P, Christ P, Li HB, et al. The Liver Tumor Segmentation Benchmark (LiTS). Med Image Anal 2023;84:102680.

5. Isensee F, Jaeger PF, Kohl SAA, Petersen J, Maier-Hein KH. nnU-Net: a self-configuring method for deep learning-based biomedical image segmentation. Nat Methods 2021;18:203-211.

---

## Supplementary Information

### Dataset Configuration Summary

```
Dataset Name: Dataset503_LiverMetaReg
Total Cases: 466
- Positive (metastasis present): 134 (28.8%)
- Negative (no metastasis): 332 (71.2%)

Intensity Preprocessing:
- Liver window clipping: [-150, 250] HU
- Applied to both baseline and follow-up images
- Subtraction range: [-400, 400] HU

Input Channels:
- Channel 0: CT_baseline_warped (registered to follow-up space, clipped)
- Channel 1: CT_followup (clipped)
- Channel 2: Subtraction image (dynamically generated: Ch1 - Ch0)

Output Labels:
- 0: Background
- 1: Liver parenchyma
- 2: Hepatic metastasis

Image Specifications:
- Dimensions: 512 × 512 × 64-108 voxels
- Spacing: Variable (typically 0.7 × 0.7 × 5.0 mm)
- File format: NIfTI (.nii.gz)
```

### Training Infrastructure

```
Hardware:
- GPU: 4 × NVIDIA GPU (24 GB VRAM each)
- Training: 4 folds in parallel

Software:
- Framework: nnU-Net v2.0
- Custom Trainer: nnUNetTrainerMedReg
- Python: 3.10
- PyTorch: 2.0+
- CUDA: 11.8+

Network Configuration (auto-configured by nnU-Net):
- Patch size: [32, 256, 224]
- Convolution kernels: Anisotropic (1×3×3 → 3×3×3)
- Training mode: From scratch (no pre-trained weights)
- Reason: Anisotropic spacing (5mm z-axis) incompatible with
          isotropic pre-trained models

Training Hyperparameters:
- Optimizer: AdamW (lr=3e-4, weight_decay=0.01, betas=(0.9, 0.999))
- LR Scheduler: PolyLR (power=0.9)
- Loss: Dice + CrossEntropy with deep supervision
- Batch size: 2
- Epochs: 1000 (early stopping)
```

<!--
TODO: Results에 Table 1 추가 필요
=====================================
Five-fold cross-validation 분포:

| Fold | Training (n) | Positive (%) | Validation (n) | Positive (%) |
|------|--------------|--------------|----------------|--------------|
| 0    | 372          | 107 (28.8%)  | 94             | 27 (28.7%)   |
| 1    | 373          | 107 (28.7%)  | 93             | 27 (29.0%)   |
| 2    | 373          | 107 (28.7%)  | 93             | 27 (29.0%)   |
| 3    | 373          | 107 (28.7%)  | 93             | 27 (29.0%)   |
| 4    | 373          | 108 (29.0%)  | 93             | 26 (28.0%)   |
-->

<!--
TODO: Supplementary Table 2 작성 필요
=====================================
Deep Learning Training 상세 파라미터:

1. Network Architecture
   - 3D U-Net with anisotropic kernels
   - Pseudo-2D convolutions (1×3×3) → 3D convolutions (3×3×3)
   - Residual encoder blocks
   - Instance normalization + Leaky ReLU

2. Training Hyperparameters
   - Batch size: 2
   - Initial learning rate: 3×10⁻⁴
   - LR scheduler: Polynomial decay (power=0.9)
   - Optimizer: AdamW (weight_decay=0.01, β₁=0.9, β₂=0.999)
   - Loss: Dice + CrossEntropy with deep supervision
   - Epochs: 1000 (early stopping)

3. Data Augmentation
   - Random rotations: ±15°
   - Scaling: 0.85–1.25
   - Elastic deformations
   - Gamma correction: 0.7–1.5
   - Mirroring: all axes
   - Additive Gaussian noise
   - Foreground oversampling: 67%

4. Hardware
   - GPU: NVIDIA 24GB VRAM × 4
   - Training time: 12–24 hours per fold

5. Temporal Consistency Loss
   - 목적: Baseline에도 존재하는 병변 예측 시 벌점 부여 → FP 감소
   - 수식: L = L_seg + λ(t) · L_cons
     - L_seg: Dice + CrossEntropy (기본 segmentation loss)
     - L_cons: Component-level consistency penalty
     - λ(t): Scheduled weight (warmup → ramp → max)
   - L_cons 계산:
     - pF, pB: Followup/Baseline softmax probability maps
     - 각 connected component k에 대해:
       - Δ_k = mean(pF[R_k]) - mean(pB[R_k_dilated])
       - g_k = sigmoid(α · (Δ_k - δ))  (growth gate)
       - pen_k = (1 - g_k) · mean(pB[R_k])
     - L_cons = mean(pen_k · size_weight_k)
   - 파라미터:
     - α (growth gate sharpness): 10
     - δ (growth threshold): 0.1
     - Dilation iterations: 1 (registration error tolerance)
     - λ_max: 0.2
     - Warmup epochs: 20, Ramp epochs: 40
-->

<!--
TODO: Supplementary Table 1 작성 필요
=====================================
CT Image Acquisition 상세 파라미터:

1. Scanner 정보 (5종)
   - 제조사별 모델명
   - 각 스캐너 사용 비율

2. 조영제 정보 (4종)
   - 제품명, 농도
   - 주입 용량 (mL/kg)
   - 주입 속도 (mL/sec)

3. 프로토콜 상세
   - Tube voltage (80/100/120 kVp 분포)
   - Tube current / reference mAs
   - Rotation time
   - Detector configuration
   - Pitch
   - Reconstruction kernel
   - Slice thickness (3mm vs 5mm 분포)
   - Field of view range
-->

<!--
TODO: Supplementary Methods 작성 필요
=====================================

### A. Image Registration 상세 파라미터

1. Intensity preprocessing
   - HU windowing range: [-150, 250]

2. Primary registration method
   - SyN (symmetric diffeomorphic transformation)
   - Rigid + Affine + Deformable stages

3. Metadata alignment
   - Physical coordinate alignment for origin/direction inconsistencies

4. Fallback strategies (Dice ≤ 0.70 시)
   - (a) Rigid-to-SyN (Affine 생략)
   - (b) Staged: Rigid → Affine → SyN

5. Registration parameters
   - Similarity metric: Mattes mutual information
   - Rigid/Affine iterations: 500 × 200 × 100 (3 levels)
   - SyN iterations: 200 × 100 × 50 × 20 (4 levels)
   - Histogram matching: Yes
   - Initial alignment: Center-of-mass
   - Mask: Liver segmentation

6. Transform application
   - Images: Linear interpolation
   - Labels: Nearest-neighbor interpolation

### B. Test Dataset Case Categorization 상세 내용

1. LLM 모델명
   - 사용한 모델 (예: GPT-4, Claude 등)
   - 모델 버전/날짜

2. 프롬프트 구조
   - System prompt
   - User prompt 템플릿
   - Output format 지정 방식

3. Radiologist 검토 프로세스
   - 검토자 자격 (경력, 전문분야)
   - 검토 기준 및 절차
   - 불일치 시 해결 방법

4. LLM-Radiologist 일치율 (해당 시)
   - Cohen's kappa 또는 agreement rate
   - 카테고리별 일치율 (NEW, EXIST, NEGATIVE, UNCERTAIN)
-->
