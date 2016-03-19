import math
sin = math.sin
cos = math.cos
tan = math.tan
atan = math.atan

from sys import exit

class Reverb(object):
    """Reverberation simulation by particle bouncing.
    Note: Object is instantiated as

    r = Reverb(p0, theta0, dim, mode)
    p0: initial position, a tuple of two as (x, y) coordinate
    theta0: initial direction, given in float.
    dim: a tuple of two floats.  dim[0] is box width; dim[1] is half of box height, or radius.
    mode: 'chaos' - cavity with two semicircles to obtain chaotic traces.
          'retangular' - regular box cavity.

    Coordinate details:
    1. The center of the cavitiy is the origin (0, 0).
    2. Theta > 0 from y-axis clockwise; theta < 0 counterclockwise.
    """

    def __init__(self, p0, theta0, dim, mode = 'chaos'):
        """Mode can be 'chaos' or 'retangular'.
        dim[0] is the width of the box.
        mode == 'chaos' ==> dim[1] is the radius of the two semicircles on the left and right.
        mode == 'retangular' ==> dim[1] is half of the box height.
        """
        self.mode = mode
        self.p = p0         ## initial (x,y) coordinate in tuple
        self.theta = theta0 ## initial direction in deg
        self.dim = dim
        bw = dim[0]         ## box width
        radius = dim[1]     ## circle radius or half height
        self.A = (bw/-2.0,  1.0*radius)
        self.B = (bw/ 2.0,  1.0*radius)
        self.C = (bw/ 2.0, -1.0*radius)
        self.D = (bw/-2.0, -1.0*radius)

    def _ang_p12(self, p1, p2):
        vec = (p2[0] - p1[0], p2[1] - p1[1])
        if vec[1] == 0 and vec[0] < 0:
            theta = -90.0
        elif vec[1] == 0 and vec[0] > 0:
            theta = 90.0
        else:
            theta = math.atan(vec[0]/vec[1])*180/math.pi
            if vec[1] < 0:
                if theta > 0:
                    theta = -180.0 + theta
                else:
                    theta =  180.0 + theta
        return theta

    def _solve_quadratic(self, b, c):
        delta = b*b - 4*c
        if delta < 0:
            print("No solutions!")
            exit()
        root1 = (-b + delta**0.5)/2
        root2 = (-b - delta**0.5)/2
        return root1, root2

    def _solve_parametric(self, px, py, radius, theta, mode = 'left'):
        """Internal function to solve parametrically the intersection of the bounced line with the circles.
        There will be two roots, i.e. two intersections.  Code will pick the right one."""
        b = 2*(px*cos(theta) + py*sin(theta))
        c = px**2 + py**2 - radius**2
        t1, t2 = self._solve_quadratic(b, c)
        x1 = px + t1*cos(theta)
        x2 = px + t2*cos(theta)
        if abs(x1-px) < 1e-5 or abs(x2-px) < 1e-5:
            ### when two intersections are on the same semicircle.
            if abs(x1-px) < 0.01:
                px = x2
                py = py + t2*sin(theta)
            else:
                px = x1
                py = py + t1*sin(theta)
        elif mode == 'left':
            ### when one intersection is on the left semicircle.
            if x1 > x2:
                px = x2
                py = py + t2*sin(theta)
            else:
                px = x1
                py = py + t1*sin(theta)
        elif mode == 'right':
            ### when one intersection is on the right semicircle.
            if x1 > x2:
                px = x1
                py = py + t1*sin(theta)
            else:
                px = x2
                py = py + t2*sin(theta)
        return px, py
    
        
    def _ang_pA(self):
        return self._ang_p12(self.p, self.A)

    def _ang_pB(self):
        return self._ang_p12(self.p, self.B)

    def _ang_pC(self):
        return self._ang_p12(self.p, self.C)

    def _ang_pD(self):
        return self._ang_p12(self.p, self.D)

    def _hitwhere(self):
        """Return one of the four boundaries, left circle, right circle, ceiling, floor."""
        px = self.p[0]
        py = self.p[1]
        theta = self.theta
        bw = self.dim[0]
        radius = self.dim[1]
        PA = self._ang_pA()
        PB = self._ang_pB()
        PC = self._ang_pC()
        PD = self._ang_pD()
        if self.mode == 'rectangular':
            if abs(px - (-bw/2)) < 1e-5:
                if theta <= PB:
                    return 'ceiling'
                if theta >  PB and theta <  PC:
                    return 'right'
                if theta >= PC:
                    return 'floor'
            elif abs(px - bw/2) < 1e-5:
                if theta >= PA:
                    return 'ceiling'
                if theta <  PA and theta >  PD:
                    return 'left'
                if theta <= PD:
                    return 'floor'
            elif abs(py - radius) < 1e-5:
                if theta < PC and theta > 0:
                    return 'right'
                elif theta > PD and theta < 0:
                    return 'left'
                else:
                    return 'floor'
            elif abs(py - (-radius)) < 1e-5:
                if theta > PB and theta > 0:
                    return 'right'
                elif theta < PA and theta < 0:
                    return 'left'
                else:
                    return 'ceiling'
            else:
                if theta >= PA and theta <= PB:
                    return 'ceiling'
                if theta >  PB and theta <  PC:
                    return 'right'
                if theta <  PA and theta >  PD:
                    return 'left'
                else:
                    return 'floor'
                
        elif self.mode == 'chaos':
            if px >= -bw/2:
                if theta >= PA and theta <= PB:
                    return 'ceiling'
                if theta >  PB and theta <  PC:
                    return 'right'
                if theta >= PC and theta <= PD:
                    return 'floor'
                else:
                    return 'left'
            if px >= bw/2:
                if theta <= PB and theta >= PA:
                    return 'ceiling'
                if theta <  PA and theta >  PD:
                    return 'left'
                if theta <= PD and theta >= PC:
                    return 'floor'
                else:
                    return 'right'
            if px > -bw/2 and px < bw/2:
                if theta >  PD and theta <  PA:
                    return 'left'
                if theta >= PA and theta <= PB:
                    return 'ceiling'
                if theta >  PB and theta <  PC:
                    return 'right'
                else:
                    return 'floor'


    def _reflection_on_box(self):
        if self.theta > 0:
            self.theta =  180.0 - self.theta
        else:
            self.theta = -180.0 - self.theta
    
    def _reflection_on_floor(self):
        px = self.p[0]
        py = self.p[1]
        theta = (-1*self.theta + 90.0)/180.0*math.pi
        radius = self.dim[1]
        self.p = (px + (-radius - py)/tan(theta), -radius)
        self._reflection_on_box()

    def _reflection_on_ceiling(self):
        px = self.p[0]
        py = self.p[1]
        theta = (-1*self.theta + 90.0)/180.0*math.pi
        radius = self.dim[1]
        self.p = (px + (radius - py)/tan(theta), radius)
        self._reflection_on_box()

    def _reflection_on_right_wall(self):
        bw = self.dim[0]
        radius = self.dim[1]
        ## initial px, py
        theta = self.theta/180.0*math.pi
        px = self.p[0]
        py = self.p[1]
        print(bw, radius, theta, px, py)
        ## after bouncing at the wall
        py = py + (bw/2 - px) / tan(theta)
        px = bw / 2
        self.p = (px, py)
        self.theta = -self.theta
            
    def _reflection_on_left_wall(self):
        bw = self.dim[0]
        radius = self.dim[1]
        ## initial px, py
        theta = self.theta
        px = self.p[0]
        py = self.p[1]
        ## after bouncing at the wall
        py = py + (-bw/2 - px) / tan(theta/180.0*math.pi)
        px = -bw / 2
        self.p = (px, py)
        self.theta = -self.theta

    def _reflection_on_left_circle(self):
        bw = self.dim[0]
        radius = self.dim[1]
        px = self.p[0] + bw/2.0
        py = self.p[1]
        theta = (-1*self.theta + 90.0)/180.0*math.pi
        p = self._solve_parametric(px, py, radius, theta, mode = 'left')

        if p[1] == 0:
            phi = -90.0
        else:
            phi = atan(p[0] / p[1])*180/math.pi

        if phi > 0:
            phi = -180.0 + phi

        self.theta = 180.0 - self.theta + 2*phi
        if self.theta > 180:
            self.theta = self.theta - 360
        elif self.theta < -180:
            self.theta = self.theta + 360
        self.p = (p[0] - bw/2.0, p[1])
        
    def _reflection_on_right_circle(self):
        bw = self.dim[0]
        radius = self.dim[1]
        px = self.p[0] - bw/2.0
        py = self.p[1]
        theta = (-1*self.theta + 90.0)/180.0*math.pi
        p = self._solve_parametric(px, py, radius, theta, mode = 'right')
  
        if p[1] == 0:
            phi = 90.0
        else:
            phi = atan(p[0] / p[1])*180/math.pi

        if phi < 0:
            phi = 180.0 + phi

        self.theta = -180.0 - self.theta + 2*phi
        if self.theta > 180:
            self.theta = self.theta - 360
        elif self.theta < -180:
            self.theta = self.theta + 360
        self.p = (p[0] + bw/2.0, p[1])
              
    def _hit_and_reflect(self):
        hit = self._hitwhere()
        print('before hit', self.p, self.theta)
        print(hit)
        if hit == 'ceiling':
            self._reflection_on_ceiling()
        if hit == 'floor':
            self._reflection_on_floor()
        if hit == 'left':
            if self.mode == 'chaos':
                self._reflection_on_left_circle()
            elif self.mode == 'rectangular':
                self._reflection_on_left_wall()
        if hit == 'right':
            if self.mode == 'chaos':
                self._reflection_on_right_circle()
            elif self.mode == 'rectangular':
                self._reflection_on_right_wall()
        print('after hit', self.p, self.theta)    
        print('\n')
        
    def bounce(self, times):
        """Bounce inside the chamebr by times (number of times)."""
        n = 0
        while n < times:
            self._hit_and_reflect()
            yield self.p, self.theta
            n += 1

    def print_info(self):
        print("Print position:")
        print(self.p)
        print("\n")
        print("Print heading direction:")
        print(self.theta)

    def walkto(self, p, theta):
        self.p = p
        self.theta = theta
            

if __name__ == '__main__':

    def test_chaos():
        rc = Reverb(p0 = (0.49, -1), theta0 = 17.99, dim =(2.0, 1.0))
        times = 3
        a = rc.bounce(times)
        for each in range(times):
            next(a)

    def test_ret():
        rc = Reverb(p0 = (0, 0), theta0 = 45, dim =(200, 200), mode = 'rectangular')
        times = 5
        a = rc.bounce(times)
        for each in range(times):
            next(a)
        
    test_ret()
