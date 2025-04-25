#!/bin/bash

INPUT_FILE='/home/laila/TER-PROJECT2/server/scenarios_with_labels.txt'
PYTHON_SCRIPT1='/home/laila/TER-PROJECT2/server/network2.py'
PYTHON_SCRIPT2='/home/laila/TER-PROJECT2/server/automation.py'
PYTHON_SCRIPT3='/home/laila/TER-PROJECT2/server/worse_before_after.py'
DIRECTORY_PATH='/home/laila/TER-PROJECT2/server/'  
FLAG_FILE='/tmp/mininet_done.flag'
FLAG_FILE2='/tmp/timeouts.flag'
TIMEOUT_LOG='/home/laila/TER-PROJECT2/server/timeout_log.txt'  # File to log timeouts

if [[ ! -f $INPUT_FILE ]]; then
    echo "Error: File $INPUT_FILE does not exist."
    exit 1
fi

while true; do
    # Find the first line where the label is 'todo'
    START_LINE=$(grep -n "todo$" $INPUT_FILE | head -n 1 | cut -d: -f1)

    if [[ -z "$START_LINE" ]]; then
        echo "No 'todo' scenarios found."
        exit 0
    fi

    echo "Starting from line $START_LINE"

    # Skip the first START_LINE-1 lines and start reading from the START_LINE
    tail -n +$START_LINE "$INPUT_FILE" | while IFS= read -r line
    do
        label=$(echo "$line" | awk '{print $NF}')  # Get the last field (label)

        if [[ "$label" == "todo" ]]; then
            echo "Starting Mininet setup with parameters: $line"
            line_number=$(echo "$line" | awk '{print $1}')
            
            # Extract the line without the label (removing the last field)
            parameters=$(echo "$line" | awk '{$NF=""; print $0}' | sed 's/ *$//')  # Remove last field and trim trailing space
            # Extract the parameters excluding the first element (line_number) and the last (label)
            parameters2=$(echo "$line" | awk '{$1=""; $NF=""; print $0}' | sed 's/^ *//;s/ *$//')  # Remove first and last fields, trim spaces
            
            echo "Passing parameters to Mininet: $parameters"
            
            # Remove any existing flag file
            sudo rm -f $FLAG_FILE
            sudo rm -f $FLAG_FILE2

            # Run Mininet with the first Python script (without the label)
            sudo python3 $PYTHON_SCRIPT1 $parameters &
            MININET_PID=$!
            echo "Mininet started with PID: $MININET_PID"

            # Wait for the flag file
            while [[ ! -f $FLAG_FILE ]]; do
                sleep 1
            done

            # Run the second Python script
            echo "Running Script 2 with scenario ID: $line_number"
            python3 $PYTHON_SCRIPT2 '/home/sghandi/Téléchargements/representant_urls.txt' '/home/sghandi/Téléchargements/nginx_cluster_1.txt' '/home/sghandi/Téléchargements/nginx_cluster_2.txt' '/home/sghandi/Téléchargements/nginx_cluster_3.txt' '/home/sghandi/Téléchargements/nginx_cluster_4.txt' $line_number
            echo "Script 2 completed."

            # Check for timeout
            if [[ -f $FLAG_FILE2 ]]; then
                echo "Timeout detected for scenario ID: $line_number"
                echo "$line_number $parameters" >> $TIMEOUT_LOG

                # Update the scenario file, mark this scenario as 'timeout'
                python3 $PYTHON_SCRIPT3 "$parameters2" 

                # Exit the loop and restart it to read the updated file
                #break
            else
                # Update the scenario file, mark this scenario as 'done'
                sed -i "/^$line_number /s/\S*$/done/" $INPUT_FILE
            fi

            sudo kill $MININET_PID
            wait $MININET_PID
            sudo mn -c
            echo "########### Network cleared."
        fi
    done
done

