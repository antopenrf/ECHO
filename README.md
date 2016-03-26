##*ECHO*##

ECHO is the reverberation chamber simulation tool to implement simple ray bouncing algorighm.  Python 'Turtle' package is used to visualize the real-time bouncing traces.  The main purpose of this tool is to trace the chaotic behaviour of speical chamber shape.  The code is still under development but can simulate basic 2D retangular box and one 2D chaotic chamber already.  Here is a list of features to develop in the future.

1. Add function to calculate the mode density
2. Extend to 3D
3. Extend for simulating more chamber geometry

Refer to the following publication for the 2D chaotic reveberation geometry used in this algorithm.

Reference: 'Chaotic Model of a New Reverberation Enclosure for EMC Compliance Testing in the Time Domain', Nicola Pasquino, IMTC 2004, Instrumentation and Measurement Technology Conference, Como, Italy, May 2004.


**Prerequisite:**
1. Python 2.7.x or Python 3.x
2. Turtle
3. matplotlib 1.4.x


**Usage:**

Retrieve git repository.
```
git clone https://github.com/antopenrf/echo.git
```

Start the demo.
```
>cd ECHO
>python sim.py

```

**Examples:**

Edit the two input files, input_chaos.sim or input_rect.sim.  Then, run simulation as

```
>python sim.py input_chaos.sim  ## for chaotic reverberation simluation
>python sim.py input_rect.sim   ## for conventional reverberation simulation
```

The simulation file is organized as below.

1.type: either chaos or rectangular

2.dim: For chaos type, dim[0] is the flat side width and dim[1] is the semicircle radius.  For rectangular type, dim[0] is the box width and dim[1] is half of the box height.

3.p0: initial particle position

4.theta0: initial particle heading direction

5.times: number of simulation iterations

6.display: True to show real time results on terminal

7.log: True to save the simulation results

8.draw: True to save the simulation figure

9.filename: filenames to save the final results


After starting the sim.py script, the real time particle bouncing should be displayed as shown below.
![demo: chaotic reverberation](/demo_chaos.png)
![demo: rectangular reverberation](/demo_rect.png)


Then use the analyze.py script to generate histogram.  The chaotic reverberation chamber does show a great variety on the bouncing intersections between two consecuetive nodes.
```
>python analyze.py (the text file of the simulation results)
```

For example of the histogram for chaotic reveberation.

![demo: chaotic reverberation](/demo_chaos_hist.png)

For example of the histogram for rectangular reveberation.
![demo: rectangular reverberation](/demo_rect_hist.png)

