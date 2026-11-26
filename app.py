import streamlit as st
import pandas as pd
import plotly.express as px

from pathlib import Path
import cv2
from src.traffic.traffic_analyzer import TrafficAnalyzer
from src.traffic.congestion_estimator import CongestionEstimator
from src.simulation.traffic_simulator import TrafficSimulator
from src.simulation.signal_controller import AdaptiveSignalController

@st.cache_resource
def get_traffic_analyzer(confidence):
    return TrafficAnalyzer(confidence=confidence)


st.set_page_config(
    page_title="AI Traffic Management System",
    page_icon="??",
    layout="wide"
)

st.markdown("""
<style>
.stApp {
    background: #0B1120;
    color: #E2E8F0;
}
[data-testid="stMetric"] {
    background: #151F32;
    border: 1px solid #263750;
    padding: 18px;
    border-radius: 12px;
}
h1, h2, h3 {
    color: #E2E8F0;
}
</style>
""", unsafe_allow_html=True)

st.title("AI-Powered Intelligent Traffic Management")
st.caption("Vehicle Detection â€¢ Congestion Analysis â€¢ Adaptive Signal Control")

st.divider()

st.sidebar.title("Control Panel")
mode = st.sidebar.radio(
    "Dashboard Mode",
    ["Traffic Simulation", "Video Analysis"]
)

st.sidebar.markdown("---")
st.sidebar.caption("Exhibition Prototype | Not for real-world signal control")

if mode == "Traffic Simulation":
    st.header("Traffic Simulation")

    duration = st.sidebar.slider(
        "Simulation duration (seconds)",
        min_value=120,
        max_value=1200,
        value=600,
        step=60
    )

    seed = st.sidebar.number_input(
        "Traffic pattern seed",
        min_value=0,
        max_value=9999,
        value=42
    )

    if st.button("Run Traffic Simulation", type="primary"):
        with st.spinner("Simulating traffic..."):
            results = TrafficSimulator(
                duration=duration,
                seed=int(seed)
            ).compare()

            st.session_state["simulation_results"] = results

    results = st.session_state.get("simulation_results")

    if results:
        fixed = results["fixed_time"]
        adaptive = results["adaptive"]

        st.subheader("Performance Overview")

        col1, col2, col3, col4 = st.columns(4)

        col1.metric(
            "Adaptive Vehicles Served",
            adaptive["vehicles_served"],
            delta=adaptive["vehicles_served"] - fixed["vehicles_served"]
        )

        col2.metric(
            "Vehicles Remaining",
            adaptive["vehicles_remaining"],
            delta=adaptive["vehicles_remaining"] - fixed["vehicles_remaining"],
            delta_color="inverse"
        )

        col3.metric(
            "Average Queue",
            adaptive["average_queue"],
            delta=round(adaptive["average_queue"] - fixed["average_queue"], 2),
            delta_color="inverse"
        )

        col4.metric(
            "Estimated Average Wait",
            f'{adaptive["estimated_average_wait"]} s',
            delta=round(
                adaptive["estimated_average_wait"] -
                fixed["estimated_average_wait"], 2
            ),
            delta_color="inverse"
        )

        st.divider()
        st.subheader("Fixed-Time vs Adaptive Control")

        comparison = pd.DataFrame({
            "Metric": [
                "Vehicles Served",
                "Vehicles Remaining",
                "Average Queue",
                "Estimated Average Wait"
            ],
            "Fixed-Time": [
                fixed["vehicles_served"],
                fixed["vehicles_remaining"],
                fixed["average_queue"],
                fixed["estimated_average_wait"]
            ],
            "Adaptive": [
                adaptive["vehicles_served"],
                adaptive["vehicles_remaining"],
                adaptive["average_queue"],
                adaptive["estimated_average_wait"]
            ]
        })

        chart_data = comparison.melt(
            id_vars="Metric",
            var_name="Signal Strategy",
            value_name="Value"
        )

        fig = px.bar(
            chart_data,
            x="Metric",
            y="Value",
            color="Signal Strategy",
            barmode="group",
            template="plotly_dark"
        )

        fig.update_layout(
            paper_bgcolor="#0B1120",
            plot_bgcolor="#0B1120",
            font_color="#E2E8F0"
        )

        st.plotly_chart(fig, use_container_width=True)

        st.subheader("Detailed Simulation Results")

        st.dataframe(
            comparison,
            use_container_width=True,
            hide_index=True
        )

        st.info(
            "Results are generated from a synthetic traffic simulation. "
            "They are not measurements from actual roads."
        )

    else:
        st.info("Select the simulation settings and click Run Traffic Simulation.")

elif mode == "Video Analysis":
    st.header("Vehicle Detection and Lane Analysis")

    video_path = Path("data/videos/traffic.mp4")
    processed_path = Path("data/processed/traffic_detected_h264.mp4")

    if processed_path.exists():
        st.subheader("Processed Traffic Video")
        st.video(str(processed_path))
    elif video_path.exists():
        st.video(str(video_path))
        st.warning("Processed detection video is not available yet.")
    else:
        st.error("Traffic video not found. Check data/videos/traffic.mp4.")

    st.caption(
        "The displayed processed video contains sampled-frame YOLO detections. "
        "It does not represent continuous vehicle tracking."
    )

    if "video_analysis_result" not in st.session_state:
        st.session_state.video_analysis_result = None

    if video_path.exists():
        st.divider()
        st.subheader("Analyze Traffic at a Selected Time")

        cap = cv2.VideoCapture(str(video_path))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        cap.release()

        if total_frames > 0 and fps > 0:
            duration = int(total_frames / fps)

            selected_second = st.slider(
                "Select video timestamp (seconds)",
                min_value=0,
                max_value=max(1, duration),
                value=0
            )

            if st.button("Analyze Selected Frame", type="primary"):
                cap = cv2.VideoCapture(str(video_path))
                cap.set(cv2.CAP_PROP_POS_MSEC, selected_second * 1000)
                success, frame = cap.read()
                cap.release()

                if success:
                    try:
                        with st.spinner("Detecting vehicles and analyzing lanes..."):
                            analyzer = get_traffic_analyzer(0.10)
                            analysis = analyzer.analyze_frame(frame)

                            congestion = CongestionEstimator().estimate(
                                analysis["lanes"]
                            )

                            signal_controller = AdaptiveSignalController()

                            lane_demand = {
                                lane: congestion[lane]["weighted_demand"]
                                for lane in ["North", "East", "South", "West"]
                            }

                            signal = signal_controller.decide(lane_demand)

                        st.session_state.video_analysis_result = {
                            "analysis": analysis,
                            "congestion": congestion,
                            "signal": signal,
                            "timestamp": selected_second
                        }

                    except Exception as error:
                        st.error(f"Analysis failed: {error}")

                else:
                    st.error("Could not read the selected video frame.")

            result = st.session_state.video_analysis_result

            if result is not None:
                analysis = result["analysis"]
                congestion = result["congestion"]
                signal = result["signal"]

                st.divider()
                st.subheader("Analyzed Frame")

                display_frame = analysis["frame"]
                if display_frame.shape[1] > 1280:
                    display_frame = cv2.resize(
                        display_frame,
                        (
                            1280,
                            int(display_frame.shape[0] * 1280 / display_frame.shape[1])
                        )
                    )

                st.image(
                    cv2.cvtColor(display_frame, cv2.COLOR_BGR2RGB),
                    use_container_width=True
                )

                st.subheader("Vehicle Detection Summary")

                col1, col2 = st.columns(2)
                col1.metric("Total Vehicles", analysis["total_vehicles"])
                col2.metric(
                    "Analyzed Timestamp",
                    f"{result['timestamp']}s"
                )

                st.subheader("Lane-wise Traffic Analysis")

                lane_rows = []

                for lane in ["North", "East", "South", "West"]:
                    lane_info = analysis["lanes"][lane]
                    congestion_info = congestion[lane]

                    lane_rows.append({
                        "Lane": lane,
                        "Vehicles": lane_info["total"],
                        "Cars": lane_info["Car"],
                        "Motorcycles": lane_info["Motorcycle"],
                        "Buses": lane_info["Bus"],
                        "Trucks": lane_info["Truck"],
                        "Weighted Demand": congestion_info["weighted_demand"],
                        "Congestion": congestion_info["congestion"]
                    })

                st.dataframe(
                    pd.DataFrame(lane_rows),
                    use_container_width=True,
                    hide_index=True
                )

                st.subheader("Adaptive Signal Recommendation")

                if signal["green_lane"] is not None:
                    st.success(
                        f"Recommended Green Lane: {signal['green_lane']} | "
                        f"Green Duration: {signal['green_duration']} seconds"
                    )
                else:
                    st.info(signal["status"])

                st.caption(
                    "Signal timing is generated by a rule-based simulation "
                    "using detections from this single frame. It is not a "
                    "live traffic signal control system."
                )
        else:
            st.warning("Unable to read video duration or frame rate.")
