#!/bin/bash
# =============================================================================
# check_status.sh
#
# Check the status of coarse screening jobs and results.
#
# Usage:
#   ./check_status.sh
#
# =============================================================================

BASE_DIR="/home/users/fangke/prag_net/optimal_design"
RESULTS_DIR="${BASE_DIR}/results"
LOGS_DIR="${BASE_DIR}/logs"

# (N, M) pairs we're tracking
NM_PAIRS=(
    "4,5"
    "4,6"
    "5,4"
    "5,5"
    "5,6"
    "6,4"
    "6,5"
)

echo "=============================================="
echo "COARSE SCREENING STATUS CHECK"
echo "$(date)"
echo "=============================================="

# Check running jobs
echo ""
echo "--- SLURM Job Status ---"
squeue -u $USER --format="%.10i %.20j %.8T %.10M %.6D %R" 2>/dev/null || echo "Could not query SLURM"

# Check completed results
echo ""
echo "--- Completed Results ---"
completed=0
pending=0

for pair in "${NM_PAIRS[@]}"; do
    N=$(echo $pair | cut -d',' -f1)
    M=$(echo $pair | cut -d',' -f2)
    
    OUTPUT_FILE="${RESULTS_DIR}/screen_N${N}_M${M}_T15.pkl"
    
    if [ -f "${OUTPUT_FILE}" ]; then
        SIZE=$(ls -lh "${OUTPUT_FILE}" | awk '{print $5}')
        MTIME=$(stat -c %y "${OUTPUT_FILE}" 2>/dev/null | cut -d'.' -f1)
        echo "  [DONE] N=${N}, M=${M}: ${OUTPUT_FILE} (${SIZE}, ${MTIME})"
        ((completed++))
    else
        # Check if there's a log file (job was started)
        LATEST_LOG=$(ls -t ${LOGS_DIR}/screen_N${N}_M${M}-*.out 2>/dev/null | head -1)
        if [ -n "${LATEST_LOG}" ]; then
            echo "  [RUNNING/FAILED] N=${N}, M=${M}: Check ${LATEST_LOG}"
        else
            echo "  [PENDING] N=${N}, M=${M}: Not started"
        fi
        ((pending++))
    fi
done

echo ""
echo "--- Summary ---"
echo "Completed: ${completed}/${#NM_PAIRS[@]}"
echo "Pending/Running: ${pending}/${#NM_PAIRS[@]}"

# Check for errors in recent logs
echo ""
echo "--- Recent Errors (last 5 .err files) ---"
for errfile in $(ls -t ${LOGS_DIR}/*.err 2>/dev/null | head -5); do
    if [ -s "${errfile}" ]; then
        echo "  ${errfile}:"
        tail -3 "${errfile}" | sed 's/^/    /'
    fi
done

echo ""
echo "=============================================="
echo "Useful commands:"
echo "  squeue -u \$USER          # Check job queue"
echo "  scancel <job_id>         # Cancel a specific job"
echo "  scancel -u \$USER         # Cancel all your jobs"
echo "  tail -f ${LOGS_DIR}/screen_N5_M5-*.out  # Follow a log"
echo "=============================================="
