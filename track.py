from turtle import *
from reverb import *

scale = 200
bw = 2.0*scale
radius = 1.0*scale

particle = Turtle()
particle.shape('circle')
particle.speed(10)
particle.penup()
particle.goto(-bw/2, -radius)
particle.pendown()
particle.goto(bw/2, -radius)
particle.circle(radius, 180)
particle.goto(-bw/2, radius)
particle.penup()
particle.goto(-bw/2, -radius)
particle.pendown()
particle.circle(-radius, 180)

particle.speed(2)

particle.penup()
particle.goto(0, 0)
particle.pendown()
particle.color('blue', 'red')

rc = Reverb(p0 = (0, 0), theta0 = 153, dim =(2.0, 1.0))
times = 3000
a = rc.bounce(times)
for each in range(times):
    next(a)
    particle.goto(scale*rc.p[0], scale*rc.p[1])

raw_input()
