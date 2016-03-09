import math
sin = math.sin
cos = math.cos
tan = math.tan
atan = math.atan

class Reverb(object):
    
    def __init__(self, p0, theta0, dim):
        self.p = p0         ## initial (x,y) coordinate in tuple
        self.theta = theta0 ## initial direction in deg
        self.dim = dim
        bw = dim[0]         ## box width
        radius = dim[1]     ## circle radius
        self.A = (bw/-2.0,  1.0*radius)
        self.B = (bw/ 2.0,  1.0*radius)
        self.C = (bw/ 2.0, -1.0*radius)
        self.D = (bw/-2.0, -1.0*radius)

    def _ang_p12(self, p1, p2):
        vec = (p2[0] - p1[0], p2[1] - p1[1])
        theta = math.atan(vec[0]/vec[1])*180/math.pi
        if vec[1] < 0:
            if theta > 0:
                return -180.0 + theta
            else:
                return  180.0 + theta
        return theta
        
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
        PA = self._ang_pA()
        PB = self._ang_pB()
        PC = self._ang_pC()
        PD = self._ang_pD()
        if px <= -bw/2:
            if theta >= PA and theta < PB:
                return 'ceiling'
            if theta >= PB and theta < PC:
                return 'right circle'
            if theta >= PC and theta < PD:
                return 'floor'
            else:
                return 'left circle'
        if px >= bw/2:
            if theta <= PB and theta > PA:
                return 'ceiling'
            if theta <= PA and theta > PD:
                return 'left circle'
            if theta <= PD and theta > PC:
                return 'floor'
            else:
                return 'right circle'
        if px > -bw/2 and px < bw/2:
            if theta >= PD and theta < PA:
                return 'left circle'
            if theta >= PA and theta < PB:
                return 'ceiling'
            if theta >= PB and theta < PC:
                return 'right circle'
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
        self.p = (px + (-radius - py)*cos(theta)/sin(theta), -radius)
        self._reflection_on_box()

    def _reflection_on_ceiling(self):
        px = self.p[0]
        py = self.p[1]
        theta = (-1*self.theta + 90.0)/180.0*math.pi
        radius = self.dim[1]
        self.p = (px + (radius - py)*cos(theta)/sin(theta), radius)
        self._reflection_on_box()

    def _reflection_on_left_circle(self):
        bw = self.dim[0]
        px = self.p[0] + bw/2.0
        py = self.p[1]
        theta = (-1*self.theta + 90.0)/180.0*math.pi
        t = -2*(px*cos(theta) + py*sin(theta))
        p = (px + t*sin(theta), py + t*cos(theta))
        phi = atan(p[0] / p[1])*180/math.pi
        if phi > 0:
            phi = 180.0 - phi
        self.theta = 180.0 - self.theta + 2*phi
        self.p = (p[0] - bw/2.0, p[1])
        
    def _reflection_on_right_circle(self):
        bw = self.dim[0]
        px = self.p[0] - bw/2.0
        py = self.p[1]
        theta = (-1*self.theta + 90.0)/180.0*math.pi
        t = -2*(px*cos(theta) + py*sin(theta))
        p = (px + t*sin(theta), py + t*cos(theta))
        phi = atan(p[0] / p[1])*180/math.pi
        if phi < 0:
            phi = 180.0 + phi
        self.theta = -180.0 - self.theta + 2*phi
        self.p = (p[0] + bw/2.0, p[1])
        
        
    def walk(self, p, theta):
        self.p = p
        self.theta = theta
            

if __name__ == '__main__':
    rc = Reverb(p0 = (0, 0.5), theta0 = 11.0, dim =(2.0, 1.0))
    print(rc._ang_pA())
    print(rc._ang_pB())
    print(rc._ang_pC())
    print(rc._ang_pD())            


    rc.walk((0,0), 19)
    print(rc.p, rc.theta,rc._hitwhere())
    rc._reflection_on_ceiling()
    print(rc.p, rc.theta)

    rc.walk((0,0), -45)
    print(rc.p, rc.theta,rc._hitwhere())
    rc._reflection_on_ceiling()
    print(rc.p, rc.theta)

    rc.walk((0,0), 170)
    print(rc.p, rc.theta,rc._hitwhere())
    rc._reflection_on_floor()
    print(rc.p, rc.theta)

    rc.walk((0,0), -170)
    print(rc.p, rc.theta,rc._hitwhere())
    rc._reflection_on_floor()
    print(rc.p, rc.theta)

    rc.walk((0,0), -91)
    print(rc.p, rc.theta,rc._hitwhere())
    rc._reflection_on_left_circle()
    print(rc.p, rc.theta)

    rc.walk((0,0), 91)
    print(rc.p, rc.theta,rc._hitwhere())
    rc._reflection_on_right_circle()
    print(rc.p, rc.theta)
    
