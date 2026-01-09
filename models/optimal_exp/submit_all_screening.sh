#!/bin/bash
# =============================================================================
# submit_all_screening.sh
#
# Master script to submit all coarse screening jobs for different (N, M) pairs.
# 
# Usage:
#   ./submit_all_screening.sh          # Submit all jobs
#   ./submit_all_screening.sh --dry-run # Just generate scripts, don't submit
#
# =============================================================================

# Configuration
BASE_DIR="/home/users/fangke/prag_net/optimal_design"
SCRIPTS_DIR="${BASE_DIR}/scripts"
RESULTS_DIR="${BASE_DIR}/results"
LOGS_DIR="${BASE_DIR}/logs"

# (N, M) pairs to run
# Format: "N,M"
NM_PAIRS=(
    "4,5"
    "4,6"
    "5,4"
    "5,5"
    "5,6"
    "6,4"
    "6,5"
)

# Sampling parameters
N_OBS_SEQ=80
N_UTT_SEQ=25
SEED=42
N_JOBS=9

# SLURM parameters
TIME="02:00:00"
CPUS=9
MEM="72G"
PARTITION="normal"

# Parse arguments
DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "=== DRY RUN MODE - Scripts will be generated but not submitted ==="
fi

# Create directories
echo "Creating directories..."
mkdir -p "${SCRIPTS_DIR}"
mkdir -p "${RESULTS_DIR}"
mkdir -p "${LOGS_DIR}"

# Generate and submit jobs
echo ""
echo "=============================================="
echo "Generating job scripts for ${#NM_PAIRS[@]} (N, M) combinations"
echo "=============================================="

SUBMITTED_JOBS=()

for pair in "${NM_PAIRS[@]}"; do
    # Parse N and M
    N=$(echo $pair | cut -d',' -f1)
    M=$(echo $pair | cut -d',' -f2)
    
    JOB_NAME="screen_N${N}_M${M}"
    JOB_SCRIPT="${SCRIPTS_DIR}/job_N${N}_M${M}.sh"
    OUTPUT_FILE="${RESULTS_DIR}/screen_N${N}_M${M}_T15.pkl"
    
    echo ""
    echo "--- Generating job for N=${N}, M=${M} ---"
    
    # Generate the SLURM script
    cat > "${JOB_SCRIPT}" << EOF
#!/bin/bash
#SBATCH --job-name=${JOB_NAME}
#SBATCH --output=${LOGS_DIR}/${JOB_NAME}-%j.out
#SBATCH --error=${LOGS_DIR}/${JOB_NAME}-%j.err
#SBATCH --time=${TIME}
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=${CPUS}
#SBATCH --mem=${MEM}
#SBATCH --partition=${PARTITION}

# =============================================================================
# Coarse Screening Job: N=${N}, M=${M}
# =============================================================================

# Print job information for debugging
echo "=============================================="
echo "Job started at: \$(date)"
echo "Running on node: \$(hostname)"
echo "Job ID: \$SLURM_JOB_ID"
echo "Available CPU cores: \$(nproc)"
echo "Parameters: N=${N}, M=${M}"
echo "=============================================="

# Load required modules
module load python/3.12.1
module load py-pandas/2.2.1_py312
module load py-numpy/1.26.3_py312
module load py-scipy/1.12.0_py312

# Verify Python version
echo "Python version: \$(python3 --version)"
echo "Python path: \$(which python3)"

# Check that required packages are available
python3 -c "import pandas; import numpy; import scipy; import joblib; print('All packages imported successfully')"
if [ \$? -ne 0 ]; then
    echo "ERROR: Failed to import required packages"
    exit 1
fi

# Set working directory
cd ${SCRIPTS_DIR}

# Run the screening script (use python3 explicitly)
python3 run_coarse_screening.py \\
    --n ${N} \\
    --m ${M} \\
    --n_obs_seq ${N_OBS_SEQ} \\
    --n_utt_seq ${N_UTT_SEQ} \\
    --seed ${SEED} \\
    --n_jobs ${N_JOBS} \\
    --verbose 1 \\
    --output ${OUTPUT_FILE}

# Check exit status
if [ \$? -eq 0 ]; then
    echo "SUCCESS: Output saved to ${OUTPUT_FILE}"
else
    echo "ERROR: Job failed with exit code \$?"
fi

echo "=============================================="
echo "Job completed at: \$(date)"
echo "=============================================="
EOF

    # Make executable
    chmod +x "${JOB_SCRIPT}"
    echo "  Created: ${JOB_SCRIPT}"
    
    # Submit the job (unless dry run)
    if [ "$DRY_RUN" = false ]; then
        JOB_ID=$(sbatch "${JOB_SCRIPT}" | awk '{print $4}')
        echo "  Submitted: Job ID ${JOB_ID}"
        SUBMITTED_JOBS+=("${JOB_NAME}:${JOB_ID}")
    else
        echo "  [DRY RUN] Would submit: ${JOB_SCRIPT}"
    fi
done

# Summary
echo ""
echo "=============================================="
echo "SUMMARY"
echo "=============================================="
echo "Total jobs: ${#NM_PAIRS[@]}"
echo "Results will be saved to: ${RESULTS_DIR}"
echo "Logs will be saved to: ${LOGS_DIR}"
echo ""

if [ "$DRY_RUN" = false ] && [ ${#SUBMITTED_JOBS[@]} -gt 0 ]; then
    echo "Submitted jobs:"
    for job in "${SUBMITTED_JOBS[@]}"; do
        echo "  - ${job}"
    done
    echo ""
    echo "Monitor jobs with: squeue -u \$USER"
    echo "Cancel all jobs with: scancel -u \$USER"
else
    echo "Scripts generated in: ${SCRIPTS_DIR}"
    echo "To submit manually: sbatch ${SCRIPTS_DIR}/job_N{n}_M{m}.sh"
fi

echo "=============================================="
