from turtle import *
from reverb import *


bw = 350     ## in cm
radius = 100 ## in cm

particle = Turtle()
particle.shape('circle')
particle.speed(10)
particle.penup()
particle.goto(-bw/2, -radius)
particle.pendown()
particle.goto(bw/2, -radius)
particle.goto(bw/2, radius)
particle.goto(-bw/2, radius)
particle.goto(-bw/2, -radius)
#particle.speed(2)

particle.penup()
particle.goto(0, 0)
particle.pendown()
particle.color('blue', 'red')

rc = Reverb(p0 = (0, 0), theta0 = 153, dim =(bw, radius), mode = 'rectangular')
times = 3000
a = rc.bounce(times)
for each in range(times):
    next(a)
    particle.goto(rc.p[0], rc.p[1])

input()
